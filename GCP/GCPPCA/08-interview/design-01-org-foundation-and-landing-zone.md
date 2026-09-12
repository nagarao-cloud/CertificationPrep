<!-- CANON — established by design-01, referenced by design-02..07 and concept-01..03.
     Do not re-derive or invent alternatives to any of the following.

     ORG HIERARCHY (one Google Cloud organization, `example.com`):
       Organization
        ├── fldr-bootstrap      → prj-bootstrap-seed (Terraform state, org-admin SA)
        ├── fldr-common         → the shared-services projects listed below
        ├── fldr-workloads
        │    ├── fldr-prod      → fldr-prod-<team>      → prj-<team>-<app>-prod
        │    ├── fldr-nonprod   → fldr-nonprod-<team>   → prj-<team>-<app>-stg
        │    └── fldr-dev       → fldr-dev-<team>       → prj-<team>-<app>-dev
        ├── fldr-tenants        → fldr-tenant-<tid>     → prj-<tid>-<app>-prod  (Tier-3/4 only)
        └── fldr-sandbox        → prj-sbx-<user-or-team>-<nn>  (time-boxed, capped)
       Environment sits ABOVE team. Team folders repeat once per environment.

     NAMING:
       Folders   `fldr-<env>-<team>` lowercase kebab, no capitals, no dots.
       Projects  `<team>-<app>-<env>` (≤30 chars, immutable ID; display name is free text).
       Groups    `grp-<team>-<env>-<role>@example.com`, role ∈ {viewer,operator,admin,breakglass}.
       SAs       `sa-<app>-<purpose>` — never a human name, never reused across environments.
       Networks  `vpc-<env>`, subnets `snet-<env>-<region>-<purpose>`.
       Labels (all mandatory, CI-enforced): env, team, cost-center, app, data-class,
              owner-group, lifecycle; plus `tenant` on Tier-3/4 projects only.

     TENANCY TAXONOMY (B2B SaaS; default is T1, promotion is one-directional):
       T1 Pooled      — shared projects, shared stores, tenant_id row scoping. DEFAULT.
       T2 Partitioned — shared runtime, per-tenant datastore + per-tenant CMEK key.
       T3 Dedicated   — per-tenant project(s) under fldr-tenants, own SAs, own CMEK.
       T4 Sovereign   — T3 + region-pinned via constraints/gcp.resourceLocations,
                        in-region key ring, separate deploy pipeline.

     ENVIRONMENT MODEL: prod / nonprod / dev are sibling FOLDERS in ONE organization,
       never separate organizations. Each has its own Shared VPC host project. No prod
       data below fldr-dev, ever (data-class label + VPC-SC perimeter excludes dev).
       fldr-sandbox is outside fldr-workloads: no hybrid route, budget-capped, expiring.

     SHARED SERVICES (all under fldr-common; each owns exactly one thing):
       prj-common-nethub-prod / -nonprod  Shared VPC host, Cloud Router, NAT, hier. firewall
       prj-common-dns        Cloud DNS private zones, on-prem forwarding, DNS peering
       prj-common-logging    org log sink targets: BigQuery, locked GCS bucket, Pub/Sub→SIEM
       prj-common-cicd       Cloud Build / Cloud Deploy, WIF pool for the SCM
       prj-common-registry   Artifact Registry + Binary Authorization attestors
       prj-common-kms        org key rings, CMEK, platform Secret Manager
       prj-common-scc        Security Command Center exports, org monitoring scope
       prj-common-billing    billing export dataset, budgets, FinOps dashboards

     POLICY BASELINE (names used consistently with 03-comparisons/06-iam-security-models.md):
       constraints/compute.vmExternalIpAccess, constraints/gcp.resourceLocations,
       constraints/iam.disableServiceAccountKeyCreation,
       constraints/iam.allowedPolicyMemberDomains, constraints/sql.restrictPublicIp.

     QUESTION ID FORMAT: D<n>-Q<nn> design, C<n>-Q<nn> concept, C3-J<nn> judgment/STAR,
                         C3-T<nn> advanced-technical concept.
-->

# Design Interviews — Org Foundation and Landing Zone

> Seventeen whiteboard questions on the *structure* axis: can you build
> the platform forty teams stand on? Written for Staff and Principal
> Cloud Architect interviews in the 2026 market, not for exam prep.
> Every "answer" here is what a candidate **says out loud** in the room
> — first person, sequenced, committing to a choice and naming the
> constraint that forced it.

**How to use this file:** read one question at a time and answer it out
loud before reading past the clarifying-questions block — the value is
in rehearsing the sequence, not recognizing the diagram. The tradeoff
table's last column is the one panels actually probe; if you can't say
when your own choice is wrong, you haven't made a choice. Cross-
references point at `03-comparisons/` for the underlying matrices; this
file deliberately does not restate them.

## Question index

| ID | Question | Band | Axis | Domain leaves |
|---|---|---|---|---|
| D1-Q01 | Landing zone for a 3,000-engineer company, 40 teams, greenfield | Staff | structure | 1.3, 2.1, 3.1 |
| D1-Q02 | Resource hierarchy after acquiring three companies with their own orgs | Staff+ | structure | 1.4, 3.1 |
| D1-Q03 | Multi-tenancy for B2B SaaS: 500 customers, 12 demanding hard isolation | Staff | structure | 1.2, 3.1 |
| D1-Q04 | Connectivity across 200 projects — Shared VPC vs Peering vs NCC vs PSC | Staff | structure | 1.3, 2.1 |
| D1-Q05 | Project vending: a compliant project on day one, without a ticket | Staff | structure | 2.3, 5.2 |
| D1-Q06 | Policy-as-code guardrails — enforced, detected, advisory | Staff | structure | 3.1, 5.2 |
| D1-Q07 | IAM group and role model that makes quarterly access review tractable | Staff | structure | 3.1, 3.2 |
| D1-Q08 | Billing, labeling, showback/chargeback architecture for 40 teams | Staff | structure | 4.2 |
| D1-Q09 | FinOps operating model — who sees cost, who acts, what the platform emits | Staff+ | structure | 4.2, 4.3 |
| D1-Q10 | Data residency across six countries without forking into six platforms | Staff+ | structure | 3.2, 1.3 |
| D1-Q11 | The exception path: a team genuinely needs what Org Policy forbids | Staff+ | structure | 3.1, 4.2 |
| D1-Q12 | Brownfield — a landing zone coexisting with an ungoverned existing org | Staff+ | structure | 1.4, 3.1 |
| D1-Q13 | The shared-services project set and its blast radius | Staff | structure | 2.1, 6.2 |
| D1-Q14 | Environment strategy — separate projects, folders, or organizations? | Staff | structure | 1.3, 3.1 |
| D1-Q15 | Tenant onboarding/offboarding as a lifecycle, with provable deletion | Staff | structure | 3.2, 4.1 |
| D1-Q16 | Architecture governance that doesn't become the bottleneck | Principal | structure | 4.2, 5.1 |
| D1-Q17 | Build vs buy: a vendor's "landing zone accelerator" | Principal | structure | 1.1, 5.1 |

---

### D1-Q01 — "We're 3,000 engineers in about 40 teams, moving to Google Cloud with nothing there today. Draw me the landing zone."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 2.1, 3.1 |
| **Axis** | structure |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D1-Q14` |

**What the interviewer is actually testing**

Whether you can impose a shape on an org before the org imposes one on
you. The skill is sequencing — what must exist before anything else can
be created — and whether you treat the hierarchy as a policy surface
rather than a filing cabinet.

**Clarifying questions to ask before drawing anything**

- **Is there one legal entity, or several?** One entity means one
  organization and folders do all the work. Several with separate
  regulatory obligations means I still want one org, but the top folder
  split becomes entity-first and I lose environment-first policy
  inheritance — a real cost I'd rather pay only if forced.
- **Do the 40 teams share a product, or are they 40 products?** Shared
  product means a shared VPC and shared data plane are cheap. Forty
  products means I optimise for independent blast radius and accept
  more network plumbing.
- **Is there an existing on-prem estate that must stay reachable?** If
  yes, the network hub and DNS forwarding are day-one work and IP
  address planning becomes the critical path. If no, I can defer the
  hub and ship teams faster.
- **Who is the platform team, and how many of them are there?** A
  six-person platform team can run a vending machine, not a ticket
  queue. That single number decides whether the design is self-service
  or gatekept.
- **What is the first workload, and when does it need to be live?** The
  landing zone gets built in the shape of its first real tenant;
  anything else is speculative.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| One Google Cloud organization | Assumed | "I'm assuming one legal entity, so one org — tell me if that's wrong, because it changes the top folder layer" | Single org is the only way Org Policy inheritance covers everything |
| Environment separation is mandatory | Assumed | "I'll assume prod and non-prod must be separately governed even where teams overlap" | Drives environment-above-team folder order |
| Hybrid connectivity to on-prem | Stated | — | Forces a network hub project and IP plan before team projects exist |
| Central audit logging, immutable | Assumed | "I'll assume audit logs must survive a project owner deleting their project" | Org-level sink to a project no workload team can touch |
| Teams self-serve new projects | Assumed | "With 40 teams and a small platform team, I'm assuming tickets aren't viable" | Project vending (`D1-Q05`) becomes day-one scope |
| Cost attribution per team | Stated | — | Mandatory labels enforced at creation, not retrofitted |

**The answer, out loud**

I'd build this in four layers, and I'd deliberately not build them in
parallel, because three of them depend on the first one existing.

Layer one is the bootstrap. Before any team touches anything, I create
a seed project under its own folder that holds nothing but Terraform
state and the single service account allowed to write at the
organization node. That project is not a shared-services project and
it is not the CI project — it is the thing that creates those. I keep
it separate because the identity that can mutate the org hierarchy
should not be the identity that runs everyone's builds. Everything
after this point is created by Terraform from that seed, including the
folders I'm about to draw.

Layer two is the hierarchy itself, and here I'll make the one call
that generates the most argument: environment sits above team. Under
`fldr-workloads` I create `fldr-prod`, `fldr-nonprod` and `fldr-dev`,
and inside each of those a folder per team. A team therefore owns
three folders, not one. I do it this way because the policies that
must never be inconsistent are environment-scoped — external IP
access, resource locations, service-account key creation, public IP on
managed databases — and putting environment on top means those attach
once each and inherit to everything below. The cost is that team-level
IAM has to be granted in three places instead of one, and I accept
that cost specifically because I'm going to automate the grant
(`D1-Q07`) and I'm never going to automate my way out of a policy that
applied to two of a team's three environments.

Layer three is shared services, under `fldr-common`. I want a small
set of single-purpose projects: the Shared VPC host projects for prod
and non-prod, DNS, logging, CI/CD, artifact registry with Binary
Authorization attestors, KMS, Security Command Center export, and
billing export. One project per concern, because these are the pieces
whose blast radius crosses every team, and a combined "platform"
project means an outage in DNS and an outage in the artifact registry
are the same outage. That's `D1-Q13` in detail.

Layer four is the workload projects themselves, and by the time I get
there the interesting work is already done — a project is just an
attachment point. It gets attached to the right Shared VPC, it
inherits the environment folder's policy set, it carries the mandatory
label set, and its logs already flow to the org sink because the sink
was defined above it. That's the actual test of whether the landing
zone is good: a new project should be compliant because of where it
sits, not because someone configured it.

The thing I'd flag to the panel unprompted is what I'm deliberately
*not* doing on day one. I'm not building a service catalogue, I'm not
building chargeback enforcement, and I'm not building a multi-region
data strategy. Those are real, and they're `D1-Q08` and later. What
has to be right on day one is the set of decisions that are expensive
to reverse: the hierarchy order, the project naming scheme, the IP
plan, and where audit logs land. Everything else can be added
underneath without moving anything.

**Architecture**

```
                        Organization: example.com
                                   │
    ┌──────────────┬───────────────┼───────────────┬──────────────┐
    ▼              ▼               ▼               ▼              ▼
┌─────────┐  ┌──────────┐   ┌────────────┐  ┌───────────┐  ┌──────────┐
│ fldr-   │  │  fldr-   │   │   fldr-    │  │  fldr-    │  │  fldr-   │
│bootstrap│  │  common  │   │ workloads  │  │ tenants   │  │ sandbox  │
└────┬────┘  └────┬─────┘   └─────┬──────┘  └─────┬─────┘  └────┬─────┘
     │            │               │               │             │
     ▼            ▼               │               ▼             ▼
 prj-bootstrap-  ┌──────────┐     │          fldr-tenant-   prj-sbx-*
 seed  ◄── (1)   │ nethub   │     │          <tid> ◄── (5)  ◄── (6)
                 │ dns      │     │
                 │ logging  │     │
                 │ cicd     │ ◄── (2)
                 │ registry │     │
                 │ kms      │     │
                 │ scc      │     │
                 │ billing  │     │
                 └──────────┘     │
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
  ┌───────────┐            ┌────────────┐            ┌───────────┐
  │ fldr-prod │            │fldr-nonprod│            │ fldr-dev  │  ◄── (3)
  └─────┬─────┘            └──────┬─────┘            └─────┬─────┘
        ▼                         ▼                        ▼
  fldr-prod-<team>          fldr-nonprod-<team>      fldr-dev-<team>
        ▼                         ▼                        ▼
  prj-<team>-<app>-prod     ...-stg                  ...-dev      ◄── (4)

  Cross-cutting: org-level Org Policy attaches at the environment
  folders, never at the org node except for the five never-negotiable
  constraints (7); one org-level log sink writes to prj-common-logging
  and cannot be overridden by any project owner (8); every project is
  attached to its environment's Shared VPC host at creation time (9).
```

**Every arrow explained:**

1. **`prj-bootstrap-seed`** — holds Terraform state and the only
   identity with org-node write access. Separate from CI/CD on
   purpose; the common wrong alternative is running org mutations from
   the same project that runs application builds, which makes every
   build pipeline a potential org-admin escalation path.
2. **`fldr-common` single-purpose projects** — one concern each. The
   wrong alternative is a single `prj-platform` holding DNS, logging
   and registry together, which converts three independent failure
   domains into one and makes least-privilege IAM impossible.
3. **Environment folders above team folders** — policy attaches once
   per environment and inherits. The wrong alternative, team folders
   on top with environment projects beneath, means forty copies of
   every environment policy and guaranteed drift by month six.
4. **Workload projects as leaves** — a project is an attachment point,
   not a configuration surface. If a project needs bespoke setup after
   creation, the landing zone has a gap.
5. **`fldr-tenants`** — reserved on day one even if empty, so that the
   first Tier-3 customer (`D1-Q03`) doesn't force a hierarchy change
   under contractual time pressure.
6. **`fldr-sandbox`** — outside `fldr-workloads` deliberately: no
   hybrid route, budget-capped, time-boxed. The wrong alternative is
   "dev is where people experiment," which quietly puts experiments
   inside the governed perimeter.
7. **Org-node policy restraint** — only constraints that are true
   everywhere forever sit at the org node. Everything conditional sits
   at the environment folder, so exceptions (`D1-Q11`) have somewhere
   to land that isn't "turn it off globally."
8. **Immutable org log sink** — defined above every workload project,
   writing to a project workload teams have no role in, so deleting a
   project doesn't delete its own audit trail.
9. **Shared VPC attachment at creation** — networking is granted by
   the vending process, not requested afterward; see `D1-Q04`.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Folder order | Environment above team | Team above environment | Environment-scoped policy attaches once and can't drift across 40 teams | When teams are separate legal entities with different regulators — then entity must be the top split and you accept per-entity policy duplication |
| Bootstrap identity | Its own seed project, separate from CI | Bootstrap from the CI/CD project | Keeps org-mutation rights out of every application build's reach | When the whole org is one team of ten and the separation costs more coordination than it buys isolation |
| Shared services | Many single-purpose projects | One consolidated platform project | Independent blast radius and per-concern IAM | When the platform team is fewer than about four people and project sprawl genuinely costs more than shared failure risk |
| Project count per workload | One project per app per environment | One project per team per environment, many apps inside | Blast radius, quota and IAM all scope to the app | When apps are tiny and numerous and per-project quota overhead dominates — then group by bounded context, not by app |
| Sandbox placement | Separate top-level folder | Reuse `fldr-dev` | Sandbox can be genuinely unrestricted because it's outside the perimeter | When compliance forbids any ungoverned environment at all — then there is no sandbox, and dev tightens to compensate |

**Making it concrete**

```hcl
# Environment-level policy attaches once and inherits to ~14 team folders.
resource "google_folder_organization_policy" "prod_no_external_ip" {
  folder     = "folders/FOLDER_ID"          # fldr-prod
  constraint = "constraints/compute.vmExternalIpAccess"
  list_policy { deny { all = true } }
}
```

Two lines of Terraform cover every production VM in the company, and
the same two lines at `fldr-dev` would be a different policy object
with a different exception list. That is the whole argument for
environment-above-team, stated as code rather than as opinion.

**What a weak answer sounds like**

- "I'd create a folder per team and put prod and dev projects inside
  each one." — it's the intuitive shape and it fails the moment a
  policy has to be true of all production; the panel is listening for
  whether you noticed policy is environment-scoped.
- "We'd use the standard blueprint." — naming an accelerator is not a
  design. The follow-up is always "which parts of it would you not
  use," and there's nowhere to go from here.
- "Everything goes in one project to keep it simple." — simple on day
  one, unrecoverable by day ninety; quota, IAM and blast radius all
  collapse together.
- "We'd sort out logging later." — audit logging is one of the few
  things that is genuinely hard to backfill, because the evidence you
  needed is the evidence you didn't collect.

**Common wrong turns**

- **Designing the network before the hierarchy.** Networking is the
  most fun part to draw, so people start there. It costs you, because
  the Shared VPC host project has to live somewhere, and if the
  hierarchy isn't settled the host project ends up wherever it was
  convenient. Recover by saying "let me put the hierarchy up first,
  then hang the network off `fldr-common`."
- **Treating folders as an org chart.** Reorgs happen yearly; policy
  boundaries shouldn't. Recover by re-framing folders as policy
  boundaries that *currently* correlate with teams.
- **Over-attaching policy at the org node.** It feels safe and it
  makes every future exception an org-wide change. Recover by moving
  everything conditional down one level while you're still drawing.
- **Forgetting the seed project.** If Terraform state lives in a
  workload project, a team can delete the landing zone. Recover
  immediately — this one is cheap to fix mid-answer and expensive to
  fix in production.

**Follow-up probes the interviewer asks next**

1. **"You've got 40 teams today. What breaks at 200?"** — not the
   hierarchy; folder depth and policy inheritance hold. What breaks is
   IP address space and the number of service projects on one Shared
   VPC host. I'd plan the IP supernet for 200 up front and expect to
   split into multiple host projects per environment by region.
2. **"A team wants a VM with an external IP in prod. What happens?"** —
   the org policy denies it, and the exception path in `D1-Q11` runs.
   The important part is that the denial is silent-fail-safe: they
   can't get it by trying harder, only by going through the path.
3. **"Who owns this in two years?"** — a platform team with a product
   manager, not an infrastructure queue. If the landing zone has no
   named owner and no roadmap, it decays into whatever the last
   urgent exception made it.
4. **"What's the first thing you'd measure?"** — time from "team wants
   a project" to "team has a compliant project." If that number is
   days, the vending machine isn't working and teams will route
   around it.
5. **"Show me where a compromised CI pipeline gets you."** — into
   `prj-common-cicd` and whatever it can deploy to, and no further,
   because the seed project's identity isn't reachable from it. That
   separation is the answer to this probe and the reason for it.
6. **"What would you cut if you had six weeks instead of six
   months?"** — bootstrap, hierarchy, org policy baseline, logging
   sink, one Shared VPC. I'd ship without vending automation and eat
   the ticket queue temporarily, because that's the only layer that
   can be retrofitted without moving resources.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the control-mechanism
  matrix backs the "Org Policy vs IAM" row; don't re-derive it.
- `03-comparisons/03-networking-connectivity.md` — the Shared VPC row
  of the VPC connectivity matrix backs callout (9).
- `05-labs/lab-01-org-iam-policy-foundation.md` — the hands-on version
  of layers one and two.
- `D1-Q05` for vending, `D1-Q13` for the shared-services blast radius.

---

### D1-Q02 — "We just closed on three acquisitions. Each one has its own Google Cloud organization. What do you do with them?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.4, 3.1 |
| **Axis** | structure |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you can separate the things that must converge from the things
that can stay divergent, and whether you'll commit to a migration
sequence with a rollback point rather than proposing a big-bang merge.
Also: do you know what actually moves between organizations and what
doesn't.

**Clarifying questions to ask before drawing anything**

- **Is the acquisition integrating into the product, or running as a
  standalone business unit?** Full integration justifies moving
  projects into our hierarchy. A standalone BU may justify leaving the
  org intact indefinitely and only converging identity and billing.
- **Are their identities in our identity provider yet?** Until they
  are, nothing else can converge — IAM bindings reference principals,
  and you cannot move a project into a hierarchy whose groups don't
  include the people who operate it.
- **What compliance obligations came with each company?** An acquired
  company under a regime we don't otherwise carry may be a reason to
  give it its own folder subtree with its own policy set rather than
  inheriting ours.
- **Is there a deadline driven by a contract — a transition services
  agreement, or a licence that expires?** That deadline, not
  architectural elegance, sets the sequence.
- **Do any of their workloads have to talk to ours on day one?** If
  yes, connectivity and IP overlap become the critical path and
  hierarchy convergence can wait.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Three separate GCP organizations exist | Stated | — | Project migration between orgs is the unit of work, not folder moves |
| Single identity provider eventually | Assumed | "I'll assume we consolidate on our IdP; if not, this whole plan changes" | IAM convergence gates hierarchy convergence |
| Billing consolidation is wanted early | Assumed | "Finance usually wants one bill before engineering wants one hierarchy" | Billing account can move independently and early |
| Some acquired workloads stay as-is | Assumed | "I'll assume at least one is a retire-or-retain candidate" | Avoids migrating things scheduled for deletion |
| Our org policy baseline eventually applies | Stated | — | Determines the order of folder placement and remediation |

**The answer, out loud**

The first thing I'd say is that "merge the organizations" isn't an
operation that exists. You don't merge orgs; you move projects between
them, one at a time, and the org nodes themselves eventually become
empty and get deleted. That reframing matters because it turns a scary
monolithic project into a queue of independently reversible moves.

So I'd sequence it in three converging tracks that run at different
speeds. Identity converges first, because everything else depends on
it: their people land in our identity provider, in groups that match
our `grp-<team>-<env>-<role>` naming, and for a period those groups
hold bindings in both organizations. That's uncomfortable and it's
temporary, and I'd say out loud that I'd rather carry dual bindings
for eight weeks than move a project whose operators can't authenticate
into it afterwards.

Billing converges second and independently. Moving a project's billing
account is a much smaller operation than moving the project, and
finance's deadline is usually earlier than engineering's. I'd get all
four organizations onto one billing account with the label taxonomy
from `D1-Q08` applied retroactively where possible, so that we have
cost visibility across the whole estate months before we have
structural convergence. This is the track that buys political goodwill
cheaply.

Hierarchy converges last and selectively. For each acquired
organization I'd triage its projects into four buckets: retire (turn
off, don't migrate), retain-in-place (leave in the acquired org
indefinitely, usually because it's a product being sunset on a known
date), rehost (move the project into our hierarchy as-is and remediate
policy violations afterwards), and rebuild (recreate in our hierarchy
because the existing project is too far from our standards to
remediate). I'd be explicit that rehost is the default and rebuild is
the exception, because rebuild means a migration project per
application and that is how this turns into an eighteen-month
programme nobody finishes.

The placement decision when a project moves in is the one I'd think
hardest about. The tempting answer is to drop each acquisition into
its own top-level folder and keep it intact. I'd resist that, because
a per-acquisition folder is an org chart artifact that will outlive
the acquisition by years and will accumulate its own policy
exceptions. Instead I'd place acquired projects into the normal
environment-then-team structure, with a transitional `acq-<company>`
team folder inside each environment that gets renamed or dissolved as
their teams integrate. The exception is an acquisition carrying a
compliance regime we don't otherwise have — that one does get its own
subtree under the relevant environment, because its policy set is
genuinely different and mixing it in would force the stricter policy
onto everyone.

Last thing I'd flag: policy remediation order. When a project moves
into `fldr-prod`, it immediately inherits our production Org Policy
set, and if that project has VMs with external IPs, those VMs don't
disappear — the constraint prevents new violations, existing resources
persist. So I'd run a dry-run policy evaluation against every candidate
project *before* the move, produce the violation list, and either fix
it first or move it into a quarantine folder with a documented,
time-boxed exception. What I would not do is move it and discover the
violations from an audit finding.

**Architecture**

```
  BEFORE                                    AFTER
  ──────                                    ─────
  org: example.com                          org: example.com
   └── fldr-workloads                        ├── fldr-workloads
        └── fldr-prod                        │    └── fldr-prod
             └── fldr-prod-<team>            │         ├── fldr-prod-<team>
                                             │         ├── fldr-prod-acq-a  ◄── (3)
  org: alpha.example  ◄── (1)                │         └── fldr-prod-acq-b
   ├── prj-a-api-prod ──────────┐            ├── fldr-regulated  ◄── (4)
   └── prj-a-legacy-erp ─┐      │            │    └── fldr-prod-acq-c
                         │      │            └── fldr-common (unchanged)
  org: beta.example      │      │
   └── prj-b-web-prod ───┼──────┤            org: alpha.example   (emptied,
                         │      │             then deleted)  ◄── (6)
  org: gamma.example     │      │
   └── prj-c-claims-prod ┼──────┤            org: gamma.example
      (HIPAA-scoped)     │      │             (retained — sunset date)
                         │      │
                    ┌────┴──────┴────┐
                    │  TRIAGE GATE   │  ◄── (2)
                    │ retire/retain/ │
                    │ rehost/rebuild │
                    └────────┬───────┘
                             ▼
                    ┌────────────────┐
                    │ dry-run policy │  ◄── (5)
                    │  evaluation    │
                    └────────────────┘

  Cross-cutting: identity converges FIRST — acquired staff land in our
  IdP with dual bindings held in both orgs during the window (7); billing
  converges SECOND and independently of hierarchy (8); each project move
  is individually reversible until the source org is deleted (9).
```

**Every arrow explained:**

1. **Three separate org nodes** — each with its own policy set, its own
   billing, and its own IdP bindings. Nothing about them is shared, and
   no operation merges them; projects move individually.
2. **Triage gate** — every project is classified before anything moves.
   The common wrong alternative is migrating in inventory order, which
   spends the most effort on the projects most likely to be retired.
3. **Transitional `acq-<company>` team folders** — acquired projects
   land in the normal environment structure under a folder that is
   explicitly temporary. The wrong alternative is a permanent
   per-acquisition top-level folder, which becomes a policy island.
4. **`fldr-regulated` subtree** — only for an acquisition carrying a
   compliance regime the rest of the org doesn't have. Giving it a
   separate subtree is cheaper than raising everyone's baseline to its
   level; see `D1-Q10` for the residency version of this argument.
5. **Dry-run policy evaluation before the move** — produces the
   violation list while the project is still in the old org and still
   easy to fix or defer. Moving first and auditing after is how you
   get a production outage from an inherited constraint.
6. **Source org emptied, then deleted** — the org node is the last
   thing to go, and until it goes every move is reversible. That
   reversibility is the reason to sequence this way at all.
7. **Identity-first convergence** — dual group bindings during the
   window. Uncomfortable, temporary, and non-negotiable: a project
   whose operators can't authenticate after the move is an outage.
8. **Billing converges independently** — cost visibility across all
   four orgs arrives months before structural convergence, which is
   both useful and politically cheap.
9. **Per-project reversibility** — the unit of rollback is one project,
   which is what makes a queue of moves safe to run continuously
   rather than as a single cutover weekend.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Merge strategy | Per-project moves into the existing hierarchy | Keep each acquired org standing indefinitely | One policy baseline, one identity model, one bill | When the acquisition is a genuinely separate business being prepared for resale — then don't entangle it at all |
| Placement of acquired projects | Normal env/team structure, transitional team folder | Permanent per-acquisition top-level folder | Avoids a policy island that outlives the integration | When the acquisition carries its own regulator — then a dedicated subtree is correct and intentional |
| Default migration mode | Rehost, remediate after | Rebuild in our standards | Rehost finishes; rebuild becomes a per-app programme | When the project is so far from baseline that remediation exceeds rebuild cost — usually a handful, not the majority |
| Convergence order | Identity → billing → hierarchy | Hierarchy first, identity later | Nothing can operate post-move without identity | When there is a hard contractual deadline to vacate an org — then hierarchy leads and you accept dual-IdP pain |
| Policy application | Dry-run before move, quarantine folder for violations | Move and let inheritance enforce | Surfaces breakage while rollback is still cheap | When the acquired estate is tiny and known-clean — then the dry-run ceremony costs more than it saves |

**What a weak answer sounds like**

- "We'd merge the three organizations into ours." — there is no merge
  operation; saying this tells the panel you haven't done one.
- "Each acquisition gets its own folder and keeps its own policies." —
  it sounds respectful of autonomy and it produces three permanent
  governance islands that nobody ever reconciles.
- "We'd migrate everything in one cutover weekend." — the unit of work
  is a project; a big-bang cutover throws away the only cheap rollback
  you have.
- "Compliance is the same everywhere, so they all inherit our
  baseline." — an acquisition that brought a new regulator is the one
  case where a separate subtree is right, and flattening it is how you
  fail an audit you didn't know you were in scope for.

**Common wrong turns**

- **Starting with the network.** IP overlap between four orgs is real
  and painful, but it only matters for projects that must talk to each
  other, which is a minority. Recover by scoping connectivity work to
  the specific pairs that need it.
- **Migrating in alphabetical or inventory order.** It feels like
  progress and it front-loads effort onto projects that triage would
  have retired. Recover by inserting the triage gate before the queue.
- **Deleting the source org too early.** It's the end of
  reversibility. Recover by making org deletion an explicit final
  milestone with its own sign-off, not a cleanup task.
- **Assuming labels carry over meaningfully.** Acquired projects have
  their own label vocabulary; cost attribution breaks silently.
  Recover by mapping their labels to ours during the billing track,
  before finance builds reports on the wrong keys.

**Follow-up probes the interviewer asks next**

1. **"One acquisition has 400 projects. Does your plan still work?"** —
   the triage gate scales; the per-project move queue scales. What
   doesn't scale is manual remediation, so at 400 I'd automate the
   dry-run evaluation and batch the moves by violation class rather
   than by team.
2. **"What if their compliance regime is stricter than ours?"** —
   separate subtree, stricter policy set attached at that folder,
   and an explicit decision about whether any of our shared services
   are allowed inside its perimeter. Usually logging is; CI/CD often
   isn't.
3. **"Who owns this in two years?"** — nobody, if you do it right; the
   acquisition folders should be dissolved and the work finished.
   If an `acq-` folder still exists in two years, the integration
   failed and someone should own saying so.
4. **"How do you handle a project that can't move because of an
   in-flight regulatory audit?"** — retain-in-place, documented, with
   a review date. The source org stays alive for exactly that project,
   which is annoying and correct.
5. **"What breaks if identity convergence slips by three months?"** —
   the hierarchy track stalls entirely, and I'd let it stall rather
   than move projects ahead of it. Billing keeps going, so the
   programme still shows progress.
6. **"Escalate this: what's the blast radius of getting the triage
   wrong?"** — classifying a live revenue system as retire. I'd
   require a named business owner's sign-off on every retire
   classification, which is the one place I'd deliberately add
   bureaucracy.

**Cross-references**

- `03-comparisons/04-migration-strategies.md` — the 6 R's matrix is
  what the four-bucket triage is a compressed form of; use that file
  for the per-application version.
- `03-comparisons/06-iam-security-models.md` — Org Policy inheritance
  semantics behind the dry-run gate.
- `D1-Q12` for the brownfield case where there's no acquisition, just
  an ungoverned org you already own.

---

### D1-Q03 — "We're B2B SaaS with 500 customers. Twelve of them are demanding hard isolation in their contracts. How do you structure tenancy?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.2, 3.1 |
| **Axis** | structure |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you'll build one platform with tiers or two platforms with a
shared name. The skill is defining isolation as a spectrum with named
levels and explicit promotion criteria, so that "hard isolation"
becomes a product decision rather than a per-deal negotiation.

**Clarifying questions to ask before drawing anything**

- **What does "hard isolation" mean in the actual contract language?**
  Separate encryption keys, separate database, separate compute, or
  separate cloud project? Each is a different tier and three of the
  four are cheap. If it's "separate physical infrastructure," that's a
  conversation with legal, not an architecture.
- **Is the isolation demand about data, or about noisy neighbours?** A
  performance-isolation demand is solved with quotas and cell-based
  capacity, not with separate projects.
- **Do the twelve pay materially more than the other 488?** If yes, a
  dedicated tier is a product line with its own margin. If no, I'd
  push back on the deal terms before I push architecture around them.
- **Is there a right-to-audit or right-to-delete clause?** That drives
  `D1-Q15` — provable deletion is far easier per-project than
  per-row.
- **How many more Tier-3 customers does sales expect next year?** The
  answer determines whether tenant onboarding must be automated on day
  one or can stay semi-manual for twelve.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| 500 customers, 12 need hard isolation | Stated | — | Pooled must be the default; dedicated must be the exception |
| One codebase across all tiers | Assumed | "I'm assuming we're not maintaining two product versions — if we are, this is a much worse problem" | Forces tier differences into deployment topology, not application code |
| Per-tenant encryption key for some | Assumed | "I'd expect at least the 12 to want their own CMEK key" | Introduces T2 as a tier between pooled and dedicated |
| Tenant data deletion must be provable | Assumed | "Enterprise contracts almost always carry this" | Favours per-tenant key and per-tenant datastore over row scoping |
| Isolation tier is a sales-visible SKU | Assumed | "Otherwise every deal renegotiates the architecture" | Makes promotion criteria a product artifact |

**The answer, out loud**

I'd name four tiers and make the default explicit, because the failure
mode here isn't picking the wrong tier for one customer — it's having
no tiers, so every enterprise deal invents its own.

Tier one, which I'd call pooled, is the default and where roughly 470
of these customers live. Shared projects, shared runtime, shared data
stores, tenant identity carried as a scoping column enforced at the
data access layer. The isolation guarantee is a software guarantee,
and I'd say that plainly rather than dressing it up — pooled tenancy
means a bug in our access layer is a cross-tenant bug. That's
acceptable for the majority and it's why the tier exists: it's the
only tier whose marginal cost per customer is near zero.

Tier two, partitioned, keeps the shared runtime but gives the tenant
their own datastore instance and their own CMEK key in `prj-common-kms`.
This is the tier most "hard isolation" contracts actually want once
you read them, because the clause is usually about key control and
data deletion, not about compute. It's dramatically cheaper than
dedicated — the runtime stays pooled, so there's no per-tenant
deployment, no per-tenant scaling floor, and no per-tenant upgrade
window. I'd try hard to land most of the twelve here.

Tier three, dedicated, is a per-tenant project under `fldr-tenants`:
their own project, their own service accounts, their own datastore,
their own key, attached to the non-prod or prod Shared VPC as
appropriate. This is what I'd give a customer whose contract genuinely
requires separate compute or whose regulator requires a separate
audit boundary. The cost is real and it's mostly operational, not
infrastructural — every dedicated tenant is another deployment target,
another thing that can be on an old version, another thing an incident
can be scoped to.

Tier four, sovereign, is tier three plus region pinning via
`constraints/gcp.resourceLocations` at the tenant folder, an in-region
key ring, and a deployment pipeline that never leaves the jurisdiction.
That's `D1-Q10`'s territory and I'd only invoke it when residency is
contractual rather than preferential.

The structural decision that makes this work is that tier is a
deployment-topology property, not an application property. The
application doesn't know what tier it's running in. It always scopes
by tenant identity, always calls the key through the same abstraction,
always writes to a datastore it resolves from configuration. If tier
leaks into application code, we've built two products, and the second
one will be perpetually behind.

The other thing I'd insist on is that promotion is one-directional and
has written criteria. A customer can move from pooled to partitioned
to dedicated; nobody goes backwards, because backwards means a data
migration with a customer-visible window and no upside for them. And
the criteria are published internally so that sales can quote the
right tier during the deal rather than committing us afterwards.

**Architecture**

```
                     ┌──────────────────────────────┐
                     │  One application codebase     │  ◄── (1)
                     │  tier is config, not code     │
                     └───────────────┬──────────────┘
                                     │
   ┌──────────────┬──────────────────┼──────────────────┬─────────────┐
   ▼              ▼                  ▼                  ▼             ▼
┌────────┐   ┌──────────┐     ┌────────────┐    ┌────────────┐  ┌──────────┐
│  T1    │   │    T2    │     │     T3     │    │     T4     │  │ promotion│
│ Pooled │   │Partition │     │ Dedicated  │    │ Sovereign  │  │  gate    │
│ (~470) │   │  (~18)   │     │   (~12)    │    │   (0 yet)  │  │ ◄── (6)  │
└───┬────┘   └────┬─────┘     └─────┬──────┘    └─────┬──────┘  └──────────┘
    │             │                 │                 │
    ▼             ▼                 ▼                 ▼
 shared        shared runtime   fldr-tenants/    fldr-tenants/
 runtime       + per-tenant     fldr-tenant-     fldr-tenant-<tid>
 ◄── (2)       datastore        <tid>/           + resourceLocations
    │          ◄── (3)          prj-<tid>-       pin  ◄── (5)
    ▼             │             app-prod
 tenant_id        ▼             ◄── (4)
 row scoping   per-tenant CMEK
               in prj-common-kms

  Cross-cutting: every tier writes audit logs to the same org sink in
  prj-common-logging, tagged with the tenant label (7); T2/T3/T4 keys all
  live in prj-common-kms unless T4 residency forces an in-region ring (8);
  onboarding and offboarding run the same pipeline for every tier, with
  tier-specific steps skipped rather than branched (9).
```

**Every arrow explained:**

1. **One codebase, tier as configuration** — the application resolves
   its datastore and key from config and never branches on tier. The
   common wrong alternative is an "enterprise edition" fork, which is
   two products with one roadmap and always loses.
2. **T1 pooled runtime with row scoping** — cheapest per tenant,
   software-enforced isolation. Wrong alternative: pretending row
   scoping is equivalent to infrastructure isolation in a contract
   negotiation. It isn't, and saying so builds credibility.
3. **T2 per-tenant datastore + CMEK** — satisfies key-control and
   provable-deletion clauses without per-tenant deployment. This is the
   tier most "hard isolation" asks actually resolve to.
4. **T3 dedicated project under `fldr-tenants`** — separate audit
   boundary, separate service accounts, separate blast radius. Wrong
   alternative: a dedicated *cluster* inside a shared project, which
   gives the operational cost of dedication without the audit boundary
   that justified it.
5. **T4 sovereign pinning** — `constraints/gcp.resourceLocations` at
   the tenant folder plus an in-region key ring. Only when residency is
   contractual; see `D1-Q10`.
6. **Promotion gate** — one-directional, written criteria, quoted by
   sales during the deal. Without it, tier assignment happens in
   contract negotiation and architecture finds out afterwards.
7. **Unified audit sink** — all tiers log to the same place with a
   tenant label, so a right-to-audit request is one query regardless of
   tier.
8. **Central key project** — keys live in `prj-common-kms` with
   per-tenant key rings, so key lifecycle is one operational process,
   not four.
9. **One onboarding pipeline, steps skipped not branched** — a
   dedicated tenant runs the same pipeline with more steps enabled.
   Branching per tier is how offboarding quietly diverges and deletion
   stops being provable (`D1-Q15`).

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Default tier | Pooled | Dedicated-by-default | Near-zero marginal cost per customer at 500 | When customers number in the dozens and each is worth enough that per-tenant ops is trivially affordable |
| Where "hard isolation" usually lands | T2 partitioned | T3 dedicated | Satisfies key-control and deletion clauses without per-tenant deployment | When the contract specifically requires separate compute or a separate audit boundary — then T3, and charge for it |
| Tier expression | Deployment topology only | Application-level tier awareness | Keeps one codebase and one roadmap | When tenants need genuinely different features, not different isolation — but that's a product fork decision, not an isolation one |
| Tenant project placement | `fldr-tenants`, outside `fldr-workloads` | Tenant projects inside the owning team's folder | Tenant lifecycle and team lifecycle are independent; offboarding shouldn't touch a team folder | When there is exactly one product team and the separation is pure ceremony |
| Promotion direction | One-way, pooled → dedicated | Allow demotion back to pooled | Demotion is a customer-visible data migration with no upside for them | When a customer is genuinely leaving the dedicated SKU and will fund the migration — rare, and treat it as a project |

**Making it concrete**

```hcl
# A T3 tenant folder: the isolation boundary is the folder, not the app.
resource "google_folder" "tenant" {
  display_name = "fldr-tenant-TENANT_ID"
  parent       = "folders/FOLDER_ID"        # fldr-tenants
}
resource "google_project" "tenant_app" {
  project_id = "TENANT_ID-app-prod"
  folder_id  = google_folder.tenant.id
  labels     = { tenant = "TENANT_ID", data-class = "customer", lifecycle = "active" }
}
```

The `tenant` label appears on the project, not inside the application —
that's the whole claim of this design, and it's what makes offboarding
a project deletion instead of a data-forensics exercise.

**What a weak answer sounds like**

- "We'd give every customer their own project — it's cleaner." — at
  500 tenants that's 500 deployment targets and a version skew problem
  that never converges.
- "Row-level tenant_id is fine, it's the same thing." — it isn't, and
  an enterprise security reviewer will say so; the credible answer
  names the difference and prices it.
- "We'd build an enterprise edition for the twelve." — a fork with one
  roadmap; the panel will ask which edition gets the next security
  patch first and there's no good answer.
- "We'd decide per customer during onboarding." — no tiers means every
  deal renegotiates the platform, which is the actual failure this
  question is about.

**Common wrong turns**

- **Conflating isolation with performance.** Noisy-neighbour
  complaints get answered with dedicated projects, which is expensive
  and doesn't fix the quota problem. Recover by separating the two
  demands explicitly and solving throughput with cells and quotas.
- **Letting the largest customer define the default tier.** One
  enterprise deal drags the whole platform to dedicated. Recover by
  naming the tier as a SKU with a price, so the deal absorbs the cost.
- **Per-tenant keys without per-tenant datastores.** Gives the
  operational burden of key management without the deletion guarantee
  people bought it for. Recover by pairing them — T2 is both or
  neither.
- **Branching the onboarding pipeline per tier.** Offboarding then
  diverges silently and deletion stops being provable. Recover by
  collapsing to one pipeline with conditional steps.

**Follow-up probes the interviewer asks next**

1. **"A Tier-1 customer finds a cross-tenant data bug. What's your
   blast radius?"** — every pooled tenant, until proven otherwise.
   That's the honest answer and it's why the access layer is the most
   reviewed code in the product and why I'd want per-tenant query
   auditing in the pooled tier specifically.
2. **"Sales just sold 40 dedicated tenants. What breaks?"** —
   deployment fan-out and version skew. At 40 I'd need progressive
   delivery across tenant projects with an enforced maximum version
   lag, and I'd revisit whether T2 can absorb most of them.
3. **"How do you prove deletion for a Tier-1 tenant?"** — you prove
   key destruction for T2+ and you prove row deletion plus backup
   expiry for T1. The T1 proof is weaker and I'd say so in the
   contract rather than in the incident.
4. **"Who owns tenant tier assignment in two years?"** — product, with
   architecture holding a veto on criteria changes. If it drifts to
   sales, tiers stop meaning anything within a year.
5. **"Escalate: what if a regulator demands per-tenant infrastructure
   for all 500?"** — that's not a tier change, that's a different
   business. I'd model the operational cost honestly and put the
   decision in front of the exec team rather than absorbing it
   architecturally.
6. **"Where does the tenant identity actually come from at runtime?"** —
   from the authenticated principal's claims, resolved once at the
   edge and carried explicitly, never inferred from a request
   parameter. Inferring it from input is the cross-tenant bug.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — CMEK vs CSEK vs EKM
  backs the T2/T4 key rows; don't restate the matrix.
- `03-comparisons/02-storage-database-options.md` — per-tenant
  datastore instance selection for T2.
- `D1-Q15` for the onboarding/offboarding lifecycle this taxonomy
  implies; `D1-Q10` for T4's residency mechanics.

---

### D1-Q04 — "You've got 200 projects that need to talk to each other and to on-prem. Shared VPC, peering, Network Connectivity Center, or Private Service Connect?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 2.1 |
| **Axis** | structure |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you understand that these four are not alternatives competing
for one slot — they solve different problems and a real estate uses
three of them simultaneously. The failure mode is picking one and
forcing everything through it.

**Clarifying questions to ask before drawing anything**

- **Does everything actually need to talk to everything?** Almost
  never. If the real graph is "most projects talk to a handful of
  shared services," the answer is mostly Private Service Connect and
  the mesh question dissolves.
- **Is there IP address space overlap anywhere, now or after
  acquisitions?** Overlap rules out flat connectivity and pushes
  toward service-level exposure.
- **How many on-prem sites, and is the count growing?** One or two
  stable sites is a different answer from forty branches growing
  quarterly — that's the Network Connectivity Center trigger.
- **Who administers the network — one team or forty?** Centralised
  administration is the Shared VPC signal; genuinely independent
  network teams push toward peering or PSC.
- **Are any of these projects in a different organization?** Shared VPC
  doesn't cross org boundaries; that constraint alone can decide the
  answer.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| ~200 projects | Stated | — | Rules out full-mesh peering immediately |
| On-prem reachability | Stated | — | Requires a hub with Cloud Router and Interconnect/VPN attachments |
| One central network team | Assumed | "I'll assume networking is centrally owned; if each team runs their own, this changes" | Shared VPC becomes the backbone |
| No IP overlap within our org | Assumed | "I'll assume we control the IP plan — with acquisitions that stops being true" | Permits flat Shared VPC addressing |
| Some services exposed across boundaries | Assumed | "There's always at least one internal API other teams consume" | PSC for those, not broad peering |

**The answer, out loud**

I'd start by refusing the premise slightly: 200 projects almost never
need 200-way connectivity. The real traffic graph in an estate this
size is a few shared services consumed by everyone, a handful of
team-internal flows, and a hybrid path to on-prem. So I'd draw the
graph first and pick mechanisms per edge.

The backbone is Shared VPC, one host project per environment in
`fldr-common`. Every workload project attaches as a service project.
That gives me one IP plan, one set of firewall policies applied
hierarchically, one place where routes live, and — the part people
undersell — one administrative boundary, so the network team can
change subnet layout without touching 200 project owners. It also
means the 200 projects aren't really 200 networks; they're 200
compute tenancies on two networks, which is why the mesh problem
doesn't appear.

On-prem attaches to the host projects through Cloud Routers. If
there's one or two sites, that's Interconnect or HA VPN attachments
directly. If the site count is meaningful and growing — and at
3,000 engineers it usually is — I'd put Network Connectivity Center
in front as the hub, so each new site is a spoke rather than a new
set of tunnels to configure against every environment.

VPC Peering I'd use sparingly and deliberately: specifically where two
networks need broad mutual reachability and cannot be the same Shared
VPC. The realistic cases are a network we inherited from an
acquisition with its own addressing, or a partner-facing VPC we want
structurally separate. I would not use peering as the general
inter-project mechanism, because it isn't transitive and because the
connection count grows quadratically — and I'd say that out loud
because it's the single most common wrong answer to this question.

Private Service Connect is where the interesting design work is. For
every case where a project needs to reach exactly one service —
another team's internal API, a managed service, a third-party
provider — PSC exposes that one service without exposing a network.
That's a much smaller blast radius than peering and it's the
mechanism I'd push teams toward by default for cross-boundary
service consumption. It also survives the case that breaks
everything else: IP overlap. Two networks with conflicting
address space can still consume each other's services via PSC.

So the composite answer is: Shared VPC as the backbone within each
environment, NCC as the hybrid hub when site count justifies it, PSC
for cross-boundary service consumption and for anything with
addressing conflicts, and peering only for the specific inherited or
partner networks that can't join the Shared VPC. I'd also note
explicitly that none of this is a security boundary on its own —
reachability is not authorisation, and the perimeter story is VPC
Service Controls, which is a different question.

**Architecture**

```
                         on-prem sites (n, growing)
                                    │
                         ┌──────────▼──────────┐
                         │  NCC hub             │  ◄── (1)
                         │  (router appliance /  │
                         │   VPN / Interconnect  │
                         │   spokes)             │
                         └──────────┬──────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌────────────────────────┐                        ┌────────────────────────┐
│ prj-common-nethub-prod │                        │ prj-common-nethub-     │
│  Shared VPC host       │  ◄── (2)               │ nonprod (host)         │
│  vpc-prod              │                        │  vpc-nonprod           │
└───────────┬────────────┘                        └───────────┬────────────┘
            │ service-project attachment                      │
   ┌────────┼────────┬─────────────┐                 ┌────────┴────────┐
   ▼        ▼        ▼             ▼                 ▼                 ▼
 prj-a    prj-b    prj-c  ...  prj-n (≈200 total)  prj-a-stg      prj-b-stg
   │                             ◄── (3)
   │
   │  PSC endpoint ──────────────────────────────► partner / managed
   │  ◄── (4)                                       service (no peering)
   │
   └──► VPC Peering ────────────► vpc-acquired-alpha  ◄── (5)
                                   (own addressing, can't join)

  Cross-cutting: hierarchical firewall policies attach at fldr-prod and
  inherit to every service project (6); Cloud DNS private zones live in
  prj-common-dns and peer to both host VPCs (7); reachability is not
  authorisation — VPC Service Controls is the exfiltration boundary and
  is configured independently of all of the above (8).
```

**Every arrow explained:**

1. **NCC hub for hybrid** — each on-prem site becomes a spoke instead
   of a full set of tunnels per environment. The wrong alternative is
   per-site VPN tunnels to each host project, which multiplies
   configuration by site count times environment count.
2. **One Shared VPC host per environment** — centralised IP plan,
   centralised firewall, one administrative boundary. Wrong
   alternative: one host project for all environments, which makes a
   non-prod firewall change a production change.
3. **Service-project attachment as the default** — 200 projects, two
   networks. This is why the "mesh problem" people expect at 200
   projects doesn't materialise.
4. **PSC for single-service exposure** — reaches exactly one service,
   survives IP overlap, minimal blast radius. Wrong alternative:
   peering the whole network because one API needed to be reachable.
5. **Peering, used narrowly** — only for a network that genuinely
   can't join the Shared VPC, typically inherited addressing from an
   acquisition (`D1-Q02`). Non-transitive, so it's a deliberate
   point-to-point exception, not a strategy.
6. **Hierarchical firewall policy at the environment folder** — one
   place to enforce baseline ingress/egress for every project below,
   which a per-VPC rule set can't guarantee.
7. **Central DNS with peering to both host VPCs** — name resolution is
   its own dependency graph and belongs in `prj-common-dns`, not
   duplicated per environment.
8. **VPC Service Controls as a separate concern** — packet
   reachability and API-level exfiltration control are different
   layers; conflating them is the most common security mistake in
   this design.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Inter-project backbone | Shared VPC per environment | Full-mesh VPC Peering | 200 projects on 2 networks; peering would be thousands of non-transitive connections | When two networks are independently administered by teams that must not share an IP plan |
| Hybrid attachment | NCC hub with spokes | Direct attachments per host project | Site count is growing; spokes scale linearly | When there are one or two permanent sites and the hub adds a management layer with nothing to manage |
| Cross-boundary service access | Private Service Connect | VPC Peering | Exposes one service, not a network; survives IP overlap | When two VPCs genuinely need broad mutual reachability across many ports and services |
| Host project split | One per environment | One host for all environments | A non-prod network change can't take prod down | When the org is small enough that two host projects is more operational surface than the isolation is worth |
| Firewall placement | Hierarchical policy at environment folder | Per-VPC firewall rules only | Baseline can't be loosened by a project-level admin | When a specific workload needs rules the hierarchy can't express — then per-VPC rules layer beneath, they don't replace |

**What a weak answer sounds like**

- "We'd peer everything." — non-transitive and quadratic; the panel is
  specifically listening for whether you know peering doesn't chain.
- "Shared VPC for everything including on-prem and partners." — Shared
  VPC doesn't cross org boundaries and doesn't solve IP overlap;
  naming its limits is most of the credibility here.
- "Network Connectivity Center because it's the newest." — NCC solves
  site-count growth. Reaching for it with two stable sites is
  complexity without a problem.
- "The VPC gives us security isolation." — reachability isn't
  authorisation; this sentence tells a security-literate panel you
  haven't separated the layers.

**Common wrong turns**

- **Designing for a fully connected graph nobody asked for.** Costs
  you an enormous address plan and a firewall matrix. Recover by
  asking for the actual traffic graph — it's always sparse.
- **Putting all environments on one Shared VPC host.** Cheap on day
  one, and then a staging firewall change causes a production
  incident. Recover by splitting hosts before any workload attaches.
- **Using peering to reach a single managed service.** Over-exposes
  the network permanently for a one-service need. Recover by
  converting to a PSC endpoint; it's a small change if caught early.
- **Forgetting DNS.** Connectivity without resolution looks like a
  network problem for days. Recover by making `prj-common-dns` and
  its forwarding zones part of the same design conversation.

**Follow-up probes the interviewer asks next**

1. **"You're at 200 projects. What happens at 2,000?"** — the Shared
   VPC host hits service-project and subnet limits and the IP plan
   gets tight. I'd shard into multiple host projects per environment
   along regional or business-unit lines, and PSC becomes the
   inter-host mechanism rather than peering.
2. **"An acquisition arrives with overlapping 10.0.0.0/8 space."** —
   they don't join the Shared VPC. PSC for the services that must
   interoperate, and a re-addressing project only if broad
   reachability is genuinely required.
3. **"Who owns the IP plan in two years?"** — the network team, with
   an allocation API rather than a spreadsheet. If subnet allocation
   is a ticket, the vending machine in `D1-Q05` stalls on it.
4. **"How does a team get a firewall rule changed?"** — through the
   same policy-as-code pipeline as everything else, with the
   hierarchical baseline unchangeable by them. Emergency path is
   break-glass, logged, time-boxed.
5. **"What's the blast radius of a bad hierarchical firewall
   policy?"** — every project in that environment, simultaneously.
   That's why it goes through dry-run evaluation and staged rollout
   at the non-prod folder first.
6. **"Where does VPC Service Controls fit?"** — around the projects
   holding regulated data, independent of the VPC topology. It stops
   an authenticated identity moving data out; the firewall stops
   packets. Different questions.

**Cross-references**

- `03-comparisons/03-networking-connectivity.md` — the VPC
  connectivity model matrix and the mesh-vs-hub diagram are the
  authoritative version of these tradeoffs; this answer is the
  interview framing on top of them, not a replacement.
- `03-comparisons/06-iam-security-models.md` — VPC-SC vs firewall
  distinction behind callout (8).
- `D1-Q13` for what happens when the network hub itself fails.

---

### D1-Q05 — "A team decides on Monday they need a new project. Walk me through how they get a compliant one without filing a ticket."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 2.3, 5.2 |
| **Axis** | structure |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you can turn governance into a product. The skill is
recognising that compliance has to be a property of the creation path,
not an audit performed afterwards — and being specific about what the
requester supplies versus what the platform decides.

**Clarifying questions to ask before drawing anything**

- **What's the current time-to-project?** If it's two days, automation
  is an optimisation. If it's three weeks, teams are already routing
  around it and shadow projects exist, which changes the first thing
  I'd build.
- **Who is allowed to request?** A team lead, anyone on the team, or a
  named budget owner? This decides whether approval is in the pipeline
  or absent by design.
- **Does a new project cost money before anything runs in it?** Mostly
  no, which is why I'd let cost approval be asynchronous rather than
  blocking creation — but the budget owner must still be recorded.
- **Is subnet allocation automated?** If IP ranges come from a
  spreadsheet, the vending machine stalls there and I'd fix that
  first.
- **What must be true before a project can hold production data?** That
  answer becomes the difference between a dev vend and a prod vend.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| No human ticket in the path | Stated | — | Approval must be encoded, not queued |
| Project is compliant at creation | Stated | — | Policy, labels, sink, network attachment all applied by the pipeline |
| Requester supplies minimal input | Assumed | "I'd want the request form to be under ten fields or people will get them wrong" | Everything else is derived from the team's registered metadata |
| Platform team is small | Assumed | "I'm assuming the platform team can't be in the loop per request" | Rules out approval-by-review |
| Requests are auditable | Assumed | "Someone will ask who created this project and why" | The request itself is a versioned artifact in source control |

**The answer, out loud**

The framing I'd use is that a project request is a pull request, not a
ticket. The team opens a change against a repository that holds the
declared state of their folder — a small file saying "we want a
project called this, for this app, in this environment, owned by this
group, charged to this cost centre." Everything else is derived.

What derivation means matters here. The requester does not choose the
Org Policy set, the log sink, the Shared VPC attachment, the label
schema, or the IAM roles. Those come from where the project sits in
the hierarchy and from the team's registered metadata. The only things
they supply are the things only they know: what it's for, who owns it,
what it's called. That ratio — a handful of supplied fields to dozens
of derived ones — is what makes the output compliant by construction.

Approval is encoded as policy checks on the change, not as a human
gate. A dev-environment project with an existing registered team and a
valid cost centre merges automatically. A production project requires
the team's registered owner group to approve — that's a code-review
approval, not a ticket — and requires that the team already has a
non-prod project for the same app, because a production project with
no staging sibling is almost always someone skipping a step. A project
requesting a policy exception doesn't merge at all; it routes to
`D1-Q11`.

The pipeline itself runs as the bootstrap identity, not as the
requester. That's the crucial separation: the requester can propose
any project, and the pipeline will only create projects that conform.
The requester never holds project-creation rights directly, which
means the guardrail can't be bypassed by someone with a shell and good
intentions.

Then there's the part that most vending designs get wrong, which is
what happens after creation. A vended project is not finished — it
drifts. Someone adds a permissive IAM binding, someone disables a
setting. So the same pipeline runs continuously in reconcile mode
against every project it created, and drift either reverts
automatically or raises a finding depending on the class of setting.
That's `D1-Q06`. Vending without reconciliation gives you a compliant
project on day one and an unknown project on day two hundred.

The last thing I'd build, and I'd build it early because it's cheap,
is the inverse operation. Every vended project has a recorded owner
group, a cost centre, and a lifecycle label. A project whose owner
group has no members, or whose lifecycle label says `experiment` and
whose creation date is over ninety days old, gets flagged and then
reclaimed. Vending machines that only dispense produce sprawl; the
ones that work also collect.

**Architecture**

```
  Team engineer
       │
       │  (1) opens PR against repo: teams/<team>/projects.yaml
       ▼
┌──────────────────────────┐
│  project request          │   name, app, env, owner-group,
│  (≤10 declared fields)    │   cost-centre, data-class
└────────────┬─────────────┘
             ▼
┌──────────────────────────────────────────────┐
│  policy checks on the change  ◄── (2)         │
│   • team registered?   • cost-centre valid?   │
│   • naming conforms?   • prod needs stg peer? │
│   • requests an exception? → route to D1-Q11  │
└────────────┬─────────────────────────────────┘
             │ merge
             ▼
┌──────────────────────────────────────────────┐
│  prj-common-cicd pipeline, running AS the     │  ◄── (3)
│  bootstrap identity — NOT as the requester    │
└────────────┬─────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────┐
│  DERIVED, never requested:  ◄── (4)           │
│   folder placement → env + team               │
│   org policy set   → inherited from folder    │
│   log sink         → inherited from org       │
│   Shared VPC attach→ env host project         │
│   label set        → from team registry       │
│   IAM bindings     → grp-<team>-<env>-<role>  │
│   budget + alert   → from cost-centre         │
└────────────┬─────────────────────────────────┘
             ▼
      compliant project     ──────► (5) continuous reconcile loop
             │                              │
             └──────────────────────────────┘
                        ▲
                        │ (6) reclamation: stale lifecycle label,
                        │     empty owner group, expired sandbox

  Cross-cutting: the request file is the audit record — who asked, when,
  approved by whom, all in version control (7); subnet allocation is an
  API call to the IP registry, never a spreadsheet lookup (8); a failed
  vend leaves nothing behind, so retry is safe (9).
```

**Every arrow explained:**

1. **PR, not ticket** — the request is a versioned artifact in the
   team's own repository path. The wrong alternative is a form that
   writes to a queue, which reintroduces the human in the loop and
   loses the audit trail in the ticket system.
2. **Policy checks as the approval** — machine-evaluable conditions
   replace a reviewer's judgment for the common case. Wrong
   alternative: platform-team review on every request, which is the
   bottleneck this design exists to remove.
3. **Pipeline runs as the bootstrap identity** — requesters never hold
   project-creation rights. This is what makes the guardrail
   unbypassable rather than merely conventional.
4. **Derived-not-requested field set** — the requester supplies what
   only they know; the platform supplies everything that must be
   uniform. Wrong alternative: a rich request form that lets teams
   choose their own policy set, which is governance theatre.
5. **Continuous reconcile** — the vended state is re-asserted on a
   schedule, because a project drifts the moment humans touch it.
   Vending without reconciliation is a day-one guarantee only.
6. **Reclamation path** — stale lifecycle labels and empty owner
   groups trigger flagging then reclamation, so the machine collects
   as well as dispenses.
7. **Request file as audit record** — "who created this project and
   why" is answered by git history, not by archaeology.
8. **IP allocation via API** — if subnet assignment is manual the
   whole pipeline degrades to a ticket with extra steps.
9. **Idempotent, leaves-nothing-behind failure** — a half-vended
   project is worse than none; retry must be safe.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Request mechanism | PR against declared state | Service-catalogue web form | Audit trail, review semantics and rollback come free from git | When the requesters are non-engineers — then a form that generates the PR is the right front end |
| Approval | Encoded policy checks | Human review per request | Small platform team can't review 40 teams' requests | When the project holds regulated data or requests an exception — then a human is the point |
| Execution identity | Bootstrap pipeline identity | Grant requesters project-creator at the folder | Guardrail can't be bypassed by a determined engineer | When a single team owns an isolated sandbox folder outright and bypass is irrelevant |
| Post-creation | Continuous reconcile | One-shot creation, audit later | Drift is certain; detection-only finds it months late | When the setting is one teams legitimately need to vary — then detect and report, don't revert (see `D1-Q06`) |
| Lifecycle | Reclamation on stale labels | Keep everything forever | Sprawl is the dominant long-run cost of self-service | When projects hold records under a legal hold — then lifecycle is governed by retention, not by activity |

**Making it concrete**

```hcl
# What the requester declares. Everything else is derived.
project_request = {
  app          = "ledger"
  env          = "prod"
  owner_group  = "grp-payments-prod-admin@example.com"
  cost_center  = "CC-4417"
  data_class   = "customer"
}
# → project_id "payments-ledger-prod", folder_id = lookup(env, team),
#   shared_vpc = host_for(env), policy set = inherited, sink = inherited.
```

Five declared fields against roughly thirty derived ones is the
measurable claim of this design. If a team can declare their own
folder or their own policy set, the vending machine isn't a guardrail,
it's a convenience wrapper.

**What a weak answer sounds like**

- "We'd have a self-service portal." — a portal that creates projects
  without deriving policy is a faster way to create non-compliant
  projects.
- "Teams get project-creator on their folder and we audit monthly." —
  monthly audit means up to thirty days of non-compliance and a
  retroactive conversation nobody enjoys.
- "Terraform modules that teams copy." — copied modules fork
  immediately; the guarantee lasts until the first local edit.
- "We'd approve requests within one business day." — a one-day SLA is
  still a queue, and the question is specifically about not having
  one.

**Common wrong turns**

- **Making the request form rich.** Every extra choice is a way to get
  it wrong and a policy you now have to validate. Recover by moving
  fields from declared to derived and defending the smaller form.
- **Skipping reconciliation.** The demo works beautifully and the
  estate degrades invisibly. Recover by naming reconcile as part of
  vending, not a follow-on project.
- **Letting the pipeline run as a broadly-privileged shared
  identity.** Convenient, and it means anyone who can influence the
  pipeline can create anything. Recover by scoping the pipeline
  identity to exactly the resource types it vends.
- **No reclamation.** Sprawl arrives quietly and the cost conversation
  in `D1-Q09` starts from a position of not knowing what's live.

**Follow-up probes the interviewer asks next**

1. **"What happens when a team needs something the vending machine
   doesn't support?"** — the request fails the policy check and routes
   to the exception path in `D1-Q11`. If the same exception appears
   three times, it becomes a supported option; that feedback loop is
   what keeps the machine from ossifying.
2. **"How do you vend 400 projects in a week during a migration?"** —
   the same pipeline, driven from a generated manifest rather than
   individual PRs. The pipeline doesn't change; the front end does.
3. **"Who owns this in two years?"** — the platform team, as a product
   with a version and a changelog. If it has no owner, the first
   unsupported request becomes a permanent manual bypass.
4. **"Escalate: what's the blast radius if the pipeline identity is
   compromised?"** — every project it can create or modify, which is
   the entire workload estate. That's why it's scoped to resource
   types rather than granted broad folder admin, and why it's separate
   from the seed identity in `D1-Q01`.
5. **"A team says the machine is too slow to iterate against. What do
   you do?"** — give them a sandbox folder where vending is
   near-instant and policy is loose, outside the perimeter. Fast
   iteration and governed production are different products.
6. **"How do you prove to an auditor that every project was created
   compliantly?"** — the git history of the request repository plus
   the reconcile loop's output, not a point-in-time scan. The scan
   proves today; the history proves always.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — role-type matrix backs
  the "pipeline identity scoped to resource types" argument.
- `05-labs/lab-01-org-iam-policy-foundation.md` — the manual version
  of what this automates.
- `D1-Q06` for the reconcile loop's policy classes; `D1-Q11` for the
  exception route.

---

### D1-Q06 — "Design your guardrails. What gets hard-blocked, what gets detected, and what's just advice?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.1, 5.2 |
| **Axis** | structure |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D1-Q05` |

**What the interviewer is actually testing**

Whether you understand that a guardrail's enforcement mode is a
product decision with a cost, not a security maximum. Anyone can block
everything; the skill is knowing which controls earn the right to
block and which ones would cost more in friction than they save in
risk.

**Clarifying questions to ask before drawing anything**

- **What has actually gone wrong here before?** Real incidents justify
  hard blocks. Hypothetical ones justify detection. If the answer is
  "nothing yet," I'd start at detect for most things and promote.
- **Is there a regulator who will ask for evidence?** Regulated
  controls get enforced and evidenced; everything else can be softer.
- **How long does a team wait for an exception today?** If the
  exception path is slow, hard blocks become outages, and teams start
  building in the sandbox permanently.
- **Do we have a non-prod environment where enforcement can be
  rehearsed?** Rolling a new constraint straight to prod is how you
  learn what depended on it.
- **Who gets paged when a detection fires?** A detection with no owner
  is a dashboard, not a control.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Three enforcement modes exist | Stated | — | Every control must be explicitly assigned one |
| Some controls are audit-evidenced | Assumed | "I'll assume there's at least one regulator in scope" | Those controls cannot be advisory |
| Teams can request exceptions | Assumed | "Hard blocks without an exception path become shadow IT" | Couples this design to `D1-Q11` |
| Policy is version-controlled | Assumed | "Policy that isn't in git can't be reviewed or rolled back" | Same pipeline as `D1-Q05` |
| Non-prod exists for rehearsal | Assumed | "I'd want to promote every constraint through non-prod first" | Determines rollout sequence |

**The answer, out loud**

I'd describe three tiers and be strict about what qualifies for each,
because the temptation is to put everything in tier one and call it
secure.

Enforced means the platform makes the bad state impossible. That's Org
Policy constraints, hierarchical firewall policies, and IAM deny
policies. I'd reserve this for things that are true everywhere,
forever, and where an exception is genuinely rare: no external IPs on
production VMs, no service-account key creation, no public IPs on
managed databases, no IAM grants to identities outside our domains,
and resource locations pinned where residency applies. Five or six
constraints, not fifty. The test I'd apply is: if this fires, is the
right answer always "the team was wrong"? If sometimes the right
answer is "the team had a good reason," it doesn't belong here.

Detected means the bad state is possible but visible within minutes,
with a named owner and a clock. Security Command Center findings,
log-based metrics on sensitive admin actions, and the reconcile loop's
drift reports. This is where most controls should live, and it's where
I'd put things like overly permissive bucket IAM, unused service
accounts with broad roles, clusters without the deployment gate, and
missing labels. The reason these are detected rather than enforced is
that each has legitimate exceptions and the enforcement version would
break real work.

Advisory means the platform has an opinion and records whether you
followed it. Recommender output, cost-efficiency suggestions,
preferred-module usage, architecture pattern conformance. No clock, no
owner, no page. Advisory controls exist because the alternative to
having an opinion is having no opinion, and because today's advisory
is often next year's detected once we've learned how often it
actually matters.

The mechanism I'd emphasise is promotion between tiers, in both
directions. A control starts advisory. If we see it correlate with
real incidents, it becomes detected. If detection shows the exception
rate is near zero, it becomes enforced. And critically, if an enforced
control generates a steady stream of legitimate exceptions, it gets
demoted — because a constraint everyone has an exception for is
producing paperwork, not safety. I'd want that promotion decision to
be a recorded architecture decision with the exception-rate data
attached, which links this to `D1-Q16`.

On rollout: every new enforced constraint goes through dry-run
evaluation across the whole estate first, then enforcement at
`fldr-dev`, then `fldr-nonprod`, then `fldr-prod`, with a defined soak
at each stage. Skipping that is how you discover that a legacy service
depended on the thing you just forbade, at the worst possible moment.

One thing I'd say explicitly: detection is not a weaker version of
enforcement, it's a different instrument. Org Policy stops a
configuration from existing. Security Command Center tells you a
configuration exists and is risky. Neither substitutes for the other,
and a design that only has one of them is either brittle or blind.

**Architecture**

```
                        ┌────────────────────────────┐
                        │   control catalogue (git)   │  ◄── (1)
                        │   every control has: tier,  │
                        │   owner, evidence, exception│
                        │   rate, promotion history   │
                        └──────────────┬─────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌──────────────────┐        ┌──────────────────────┐     ┌──────────────────┐
│  1. ENFORCED      │        │  2. DETECTED          │     │  3. ADVISORY      │
│  state impossible │  ◄─(2) │  state visible + owned│◄─(3)│  opinion recorded │◄─(4)
├──────────────────┤        ├──────────────────────┤     ├──────────────────┤
│ vmExternalIpAccess│        │ SCC findings          │     │ Recommender       │
│ resourceLocations │        │ log-based metrics on  │     │ cost efficiency   │
│ disableSAKeyCreat.│        │  sensitive admin acts │     │ preferred modules │
│ allowedPolicyMemb.│        │ reconcile drift report│     │ pattern conform.  │
│ sql.restrictPublicIp│      │ label completeness    │     │                   │
│ hierarchical FW   │        │                       │     │                   │
└─────────┬────────┘        └───────────┬──────────┘     └─────────┬────────┘
          │                              │                          │
          │ exception →  D1-Q11          │ owner + clock            │ no page
          ▼                              ▼                          ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  PROMOTION / DEMOTION, decided on exception-rate evidence  ◄── (5)   │
   │   advisory ──► detected ──► enforced                                 │
   │   enforced ──► detected  (when legitimate exceptions are routine)    │
   └─────────────────────────────────────────────────────────────────────┘

  Rollout for any new ENFORCED control: dry-run across estate → fldr-dev
  → soak → fldr-nonprod → soak → fldr-prod (6); every tier's output lands
  in prj-common-scc and prj-common-logging so evidence is one query (7);
  a control with no named owner is deleted, not downgraded (8).
```

**Every arrow explained:**

1. **Control catalogue in git** — each control carries its tier,
   owner, evidence requirement and exception history. The wrong
   alternative is policy scattered across consoles, where nobody can
   answer "why is this on."
2. **Enforced tier, deliberately small** — five or six constraints
   where the answer to a violation is always "the team was wrong."
   Wrong alternative: enforcing everything, which produces a permanent
   exception queue and teaches teams that the platform is an obstacle.
3. **Detected tier as the default home** — most controls belong here
   because most have legitimate exceptions. Detection with a named
   owner and a clock is a real control, not a consolation prize.
4. **Advisory tier** — an opinion with no page attached. Exists so the
   platform can express preferences before it has the evidence to
   enforce them.
5. **Bidirectional promotion on evidence** — exception rate is the
   metric. A constraint everyone excepts gets demoted; that's the part
   most governance designs omit and it's what keeps the catalogue
   honest.
6. **Staged rollout with soak** — dry-run first, then environment by
   environment. Skipping this discovers hidden dependencies in
   production.
7. **Unified evidence path** — all three tiers emit to the same
   logging and posture projects, so audit evidence is one query rather
   than three systems.
8. **Ownerless controls get deleted** — a detection nobody owns is a
   dashboard. Deleting it is more honest than leaving it firing.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Default tier for a new control | Detected | Enforced | Preserves velocity while gathering exception-rate evidence | When the control is regulator-mandated and evidence of prevention is the requirement, not evidence of detection |
| Size of enforced set | Five or six constraints | Comprehensive enforcement | Small enough that every constraint is defensible individually | When the environment is genuinely high-assurance (classified, payment cardholder) — then broad enforcement and a heavy exception process is correct |
| Demotion | Allowed, on exception-rate evidence | Enforced controls are permanent | A constraint with routine exceptions is producing paperwork | When demoting would break an audit assertion already made to a regulator |
| Detection ownership | Named owner and clock per finding class | Central security team owns all findings | Findings reach whoever can actually fix them | When the org is small enough that one team genuinely is the owner of everything |
| Rollout | Dry-run then dev/nonprod/prod with soak | Enable org-wide immediately | Surfaces hidden dependencies where they're cheap | When the constraint closes an actively exploited gap — then speed beats soak, consciously |

**Making it concrete**

```hcl
# Enforced at fldr-prod, with a documented exception list — not org-wide,
# so that D1-Q11's exception path has somewhere to attach.
resource "google_folder_organization_policy" "no_sa_keys" {
  folder     = "folders/FOLDER_ID"
  constraint = "constraints/iam.disableServiceAccountKeyCreation"
  boolean_policy { enforced = true }
}
```

Attaching at the folder rather than the org node is the whole
difference between "we have an exception process" and "we turn the
control off for everyone when one team needs it."

**What a weak answer sounds like**

- "We'd enforce everything we can." — produces an exception queue that
  becomes the real bottleneck, and teaches teams to build outside the
  perimeter.
- "Security Command Center is our guardrail." — SCC is detective; it
  tells you something happened. Calling it a guardrail conflates two
  layers the panel expects you to separate.
- "Policies are set in the console by the security team." — not
  reviewable, not rollback-able, and nobody can explain why a
  constraint exists six months later.
- "Exceptions are handled case by case." — without a defined path
  that's a euphemism for "whoever escalates loudest wins."

**Common wrong turns**

- **Enforcing at the org node by default.** It feels strongest and it
  means the only way to grant an exception is to weaken the control
  globally. Recover by moving conditional constraints down to
  environment folders.
- **Treating detection as failure.** Teams read a detected finding as
  "we got caught." Recover by framing detection tiers publicly, with
  owners and clocks, so it reads as a process rather than a judgment.
- **Never demoting.** The catalogue only grows and eventually every
  control has an exception list longer than its rationale. Recover by
  scheduling an exception-rate review, which is `D1-Q16`'s cadence.
- **No dry-run before enforcement.** The classic version is pinning
  resource locations and discovering a build pipeline ran in an
  unapproved region. Recover by making dry-run a required stage, not
  an optional courtesy.

**Follow-up probes the interviewer asks next**

1. **"Give me a control you'd deliberately leave advisory forever."** —
   preferred-module usage. Enforcing it would freeze teams on the
   platform team's release cadence, and the cost of divergence is
   low and visible.
2. **"A detected finding has been open for ninety days. What's the
   process?"** — it escalates to the owner's manager and then becomes
   an accepted risk with an expiry date, recorded. Findings that
   neither close nor expire are the failure mode.
3. **"How does this scale from 40 teams to 200?"** — the enforced set
   doesn't grow; the detected set does, and the constraint becomes
   finding triage rather than policy authoring. I'd invest in routing
   findings to owners automatically well before 200.
4. **"Who owns the control catalogue in two years?"** — a security
   architecture function jointly with platform, with the exception
   data as the shared artifact. If security owns it alone it grows
   monotonically; if platform owns it alone it shrinks.
5. **"Escalate: what's the blast radius of a bad enforced
   constraint?"** — every resource creation in its scope stops,
   immediately, across every team below it. That's precisely why the
   rollout is staged and why the org node holds almost nothing.
6. **"How do you evidence this to an auditor?"** — the git history of
   the catalogue, the dry-run and enforcement records, and the
   exception register. The point is showing the control was on
   continuously, not that it's on today.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the preventive vs
  detective distinction and the Org Policy constraint table are
  authoritative; this answer adds the tiering framing on top.
- `D1-Q05` for the reconcile loop that feeds the detected tier;
  `D1-Q11` for the exception route the enforced tier requires;
  `D1-Q16` for the promotion/demotion cadence.

---

### D1-Q07 — "Forty teams, thousands of engineers. Design the IAM model so that quarterly access review is something a human can actually complete."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.1, 3.2 |
| **Axis** | structure |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you design IAM for the review, not just for the grant. The
skill is reducing the number of distinct things a reviewer must judge
— which means collapsing thousands of bindings into a small number of
reviewable assertions, and being explicit about what that collapse
costs.

**Clarifying questions to ask before drawing anything**

- **Who actually performs the review — the team lead or a central
  compliance function?** A team lead can judge "should Priya be an
  operator on payments-prod." Nobody can judge ten thousand raw
  bindings, so this decides where the review is aggregated.
- **Is the review a regulatory requirement with an evidence format?**
  If yes, the output shape is fixed and I'd design backwards from it.
- **How fast does the org reorg?** High reorg rates make role
  definitions tied to org structure decay quickly.
- **Are there non-human identities in scope?** Service accounts
  usually outnumber humans and are the part that's actually reviewed
  badly.
- **Is there any standing production access today?** Removing it is
  the single biggest reduction in review surface, and it's a cultural
  fight worth naming early.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Quarterly review must complete | Stated | — | Review surface must be bounded, not proportional to headcount |
| Groups are managed in the IdP | Assumed | "I'm assuming group membership is authoritative in the IdP, not in Google Cloud" | IAM binds groups; membership review happens upstream |
| Production access is elevated, not standing | Assumed | "I'd push hard for this — it's the biggest single reduction in review surface" | Time-bound access removes most prod bindings from the review entirely |
| Service accounts are in scope | Assumed | "Auditors always ask about non-human identities eventually" | Needs its own review track with different criteria |
| Predefined roles preferred | Assumed | "Custom roles only where predefined genuinely doesn't fit" | Keeps the role catalogue reviewable |

**The answer, out loud**

The core move is that nobody ever reviews a binding. Bindings are
generated; what gets reviewed is group membership and the role
catalogue, and both of those are small.

Concretely: IAM is only ever granted to groups, never to individual
users, and the group names are mechanical —
`grp-<team>-<env>-<role>@example.com` with role drawn from a fixed set
of four. Those groups are bound at the team folder for each
environment, not at individual projects, so a team with eleven
projects still has four bindings per environment, not forty-four. The
binding layer is therefore generated entirely from the team registry
by the same pipeline that vends projects, and it's reconciled — a
binding that appears outside the pipeline is drift and gets reverted.

That collapses the review into two much smaller questions. First:
should this person be in this group? That's a question the team lead
can answer in minutes for their own team, and it's the only question
most reviewers ever see. Second: does this role grant what we think it
grants? That's a question about the role catalogue — four roles times
a handful of variations — answered once centrally, not per team.

The third track, and the one that's usually neglected, is service
accounts. They outnumber humans, they accumulate, and they're granted
by engineers under delivery pressure. I'd handle them by giving every
service account a mandatory owner label pointing at a group, forbidding
key creation via `constraints/iam.disableServiceAccountKeyCreation`,
and making the review question "is this workload still running" rather
than "is this permission right." A service account belonging to a
deleted workload is the finding you actually want, and it's
answerable from usage data rather than judgment.

Production access is where I'd spend the political capital. Standing
production access is the single largest contributor to review volume,
and it's mostly unused. I'd move production to elevated, time-bound
access — a person requests the operator role for a window, with a
reason, and it expires. The steady-state production binding set then
holds a handful of break-glass groups and the service accounts, and
the quarterly review of production becomes genuinely small. The
elevation events themselves get reviewed as a log, which is a
different and easier exercise than reviewing a permission list.

What this costs is real and I'd name it. Group-only binding means a
one-off need becomes "create a group or use an existing one," which
feels heavy in the moment. Folder-level binding means access is
slightly broader than strictly necessary — an operator on a team
folder can operate all of that team's projects in that environment.
I accept that because the alternative, per-project least privilege,
produces a binding count nobody reviews honestly, and an unreviewed
narrow permission is worth less than a reviewed slightly-broad one.

**Architecture**

```
   IdP (authoritative for membership)
        │
        │  grp-<team>-<env>-<role>@example.com     ◄── (1)
        │   role ∈ { viewer, operator, admin, breakglass }
        ▼
┌──────────────────────────────────────────────────────────┐
│  team registry (git)  →  generated IAM bindings  ◄── (2)  │
└───────────────────────────┬──────────────────────────────┘
                            │  bound at FOLDER, not project
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  fldr-dev-<team>    fldr-nonprod-<team>   fldr-prod-<team>
  standing access    standing access       ◄── (3) NO standing
                                            operator/admin
                                                 │
                                                 ▼
                                     ┌───────────────────────┐
                                     │ elevation request      │ ◄── (4)
                                     │ reason + window + expiry│
                                     └───────────────────────┘

  Service accounts (separate review track)  ◄── (5)
   sa-<app>-<purpose>  +  mandatory owner-group label
   key creation denied org-wide; review question is
   "is this workload still running?", answered from usage data

  QUARTERLY REVIEW = three bounded artifacts:  ◄── (6)
   A. group membership per team        → team lead, minutes
   B. role catalogue (4 roles + few)   → central, once
   C. service accounts with no usage   → generated list, not judgment

  Cross-cutting: bindings outside the pipeline are drift and get reverted
  (7); breakglass groups are empty by default and their use pages (8);
  every elevation and every membership change lands in prj-common-logging
  so the review has evidence rather than assertion (9).
```

**Every arrow explained:**

1. **Mechanical group naming with four roles** — the name encodes
   team, environment and privilege level, so a reviewer reads
   intent from the name. Wrong alternative: descriptive group names
   invented per team, which makes the catalogue unreviewable.
2. **Bindings generated from the team registry** — humans edit the
   registry, never the bindings. This is what makes the binding count
   irrelevant to the review.
3. **No standing operator or admin in production** — the biggest
   single reduction in review surface. Wrong alternative: standing
   access with quarterly attestation, which reviews a list that was
   never accurate.
4. **Elevation with reason, window and expiry** — production access
   becomes an event stream to review rather than a permission list.
5. **Service accounts as a separate track** — reviewed on usage, not
   on judgment, with a mandatory owner group. Wrong alternative:
   folding them into the human review, where they're rubber-stamped.
6. **Three bounded review artifacts** — membership, catalogue, unused
   service accounts. Each is small enough that a human finishes it,
   which is the entire objective.
7. **Drift reversion** — a console-created binding doesn't survive the
   reconcile loop, so the generated state stays the true state.
8. **Empty break-glass groups that page on use** — available in an
   incident, impossible to use quietly.
9. **Evidence in the central log project** — the review's output is
   backed by records, which is what turns attestation into audit
   evidence.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Binding principal | Groups only | Users directly for exceptions | One membership change beats hunting bindings across projects | When an external auditor needs read access for a fixed two-week engagement — a time-bound user binding is honest and simpler than a group of one |
| Binding level | Team folder per environment | Per project | Binding count stays proportional to teams, not projects | When one project inside a team holds materially more sensitive data — then bind that project separately and say why |
| Production access | Elevated, time-bound | Standing with quarterly attestation | Removes most of the review surface and gives an event trail | When an on-call rotation needs sub-minute response and elevation latency would extend outages — then standing break-glass with heavy logging |
| Role type | Predefined roles | Custom roles everywhere | Google maintains them as services evolve; catalogue stays small | When a predefined role genuinely over-grants for a sensitive, frequently-used function — then one custom role, owned and reviewed |
| Service account review | Usage-based, owner-labelled | Permission-based review alongside humans | "Is the workload alive" is answerable; "is this permission right" isn't, at volume | When a service account holds unusually broad privilege — then it graduates to individual permission review by name |

**Making it concrete**

```hcl
# Generated, never hand-written. One binding per team per env per role.
resource "google_folder_iam_binding" "operator" {
  folder  = "folders/FOLDER_ID"                     # fldr-nonprod-payments
  role    = "roles/compute.instanceAdmin.v1"
  members = ["group:grp-payments-nonprod-operator@example.com"]
}
```

The reviewable artifact is the group's membership, not this resource.
If a reviewer ever has to read this file to do their job, the model
has failed.

**What a weak answer sounds like**

- "We'd use least privilege and review quarterly." — states the goal,
  not the mechanism; the question is specifically about making the
  review finishable.
- "Custom roles for every team's exact needs." — a catalogue of forty
  bespoke roles that nobody can compare, and that silently go stale as
  services add permissions.
- "We'd bind at the project level for tightest scope." — correct in
  isolation, and it generates a binding count that guarantees
  rubber-stamped reviews.
- "Service accounts are handled by the platform team." — that's where
  the real findings are; waving at it is the most common gap an
  auditor pulls on.

**Common wrong turns**

- **Optimising the grant instead of the review.** Produces beautiful
  least privilege that nobody validates. Recover by asking "who reads
  this, and how long does it take them."
- **Letting group names be descriptive.** `payments-team-prod-folks`
  tells you nothing about privilege. Recover early — renaming groups
  after bindings exist is painful.
- **Treating elevation as a security product rather than an
  operational one.** If elevation is slow, on-call engineers will keep
  standing access by any means. Recover by measuring elevation latency
  as a platform SLO.
- **Ignoring service-account sprawl until an audit.** Recover by
  making the owner-group label mandatory at creation, which is a
  vending-machine change, not an IAM change.

**Follow-up probes the interviewer asks next**

1. **"An engineer moves from payments to risk. What happens?"** — one
   membership change in the IdP; every binding follows automatically
   because nothing was bound to them personally. That's the single
   best demonstration of why group-only binding is worth its
   friction.
2. **"How does this scale to 200 teams?"** — linearly, because review
   volume is proportional to teams, not projects or people. What
   strains is role-catalogue drift, so I'd add automated diffing of
   predefined role contents over time.
3. **"Who owns this in two years?"** — identity engineering owns the
   group model and the IdP integration; platform owns the binding
   generation; team leads own membership. If any of those three is
   unowned, the model degrades to per-project bindings within a year.
4. **"Escalate: what's the blast radius of a compromised
   `grp-<team>-prod-admin` member?"** — that team's entire production
   folder. That's why admin is elevation-only and break-glass pages;
   the standing-access version of this answer is much worse.
5. **"An auditor asks for evidence that access was appropriate all
   quarter, not just at review time."** — the elevation event log plus
   membership change history, both in the central logging project.
   Point-in-time attestation alone doesn't answer that question.
6. **"What if a team insists on standing production access?"** — I'd
   ask what incident they're protecting against and measure elevation
   latency against it. If elevation genuinely can't meet their
   response requirement, standing break-glass with paging is the
   honest compromise, recorded as an exception.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the IAM role-type
  matrix and credential mechanism matrix back the predefined-role and
  service-account rows; not restated here.
- `D1-Q05` for the pipeline that generates bindings; `D1-Q06` for the
  constraint that forbids service-account keys.

---

### D1-Q08 — "Forty teams on one bill. Design billing, labeling and chargeback."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 4.2 |
| **Axis** | structure |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D1-Q05` |

**What the interviewer is actually testing**

Whether you treat cost attribution as an architectural property
enforced at resource creation, or as a reporting problem solved after
the fact. The second never works, and the panel knows it.

**Clarifying questions to ask before drawing anything**

- **Does finance want showback or chargeback?** Showback is a
  reporting problem. Chargeback means the numbers feed a general
  ledger and therefore must be defensible to the cent, which is a
  much higher bar and changes how I treat unattributable cost.
- **What's the smallest unit finance cares about — team, product, or
  customer?** Per-customer unit cost in a pooled SaaS tier is a
  genuinely hard problem and I'd want to know if it's in scope before
  I promise it.
- **How much of the spend is shared services?** If the network hub,
  logging and CI are a meaningful fraction, the allocation method for
  shared cost is the real design question.
- **Are commitments and discounts centrally purchased?** If yes, their
  benefit has to be distributed somehow, and that method needs to be
  decided before teams see numbers.
- **Will teams have budget authority, or only visibility?** Visibility
  without authority produces complaints; authority without visibility
  produces surprises.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| One billing account | Assumed | "I'll assume one billing account with projects beneath, unless legal entities force a split" | Single export dataset, single discount pool |
| Per-team attribution | Stated | — | Labels and project naming must carry team identity |
| Shared cost must be allocated | Assumed | "There's always a shared-services bill nobody volunteers to own" | Requires an explicit, published allocation rule |
| Labels enforced at creation | Assumed | "Retrofitted labels are never complete" | Couples this to the vending machine |
| Monthly cadence | Assumed | "I'll assume finance closes monthly; daily data, monthly truth" | Determines how alerts differ from reports |

**The answer, out loud**

The whole design rests on one claim: attribution must be structural,
not analytical. If I can derive which team owns a cost from where the
resource sits in the hierarchy plus the labels it was born with, cost
reporting is a query. If I have to infer it, cost reporting is a
recurring argument.

So the first layer is the hierarchy itself. Because environment and
team are folders, and because every project is named
`<team>-<app>-<env>`, a very large fraction of spend is attributable
from the project's place in the tree alone — before labels do any work
at all. I'd emphasise that, because label-based attribution is fragile
and hierarchy-based attribution isn't: a resource can lose a label, it
cannot lose its project.

The second layer is the mandatory label set, applied by the vending
machine and reconciled continuously: `env`, `team`, `cost-center`,
`app`, `data-class`, `owner-group`, `lifecycle`, plus `tenant` on
dedicated tenant projects. Labels do the work the hierarchy can't —
distinguishing two apps in one project, tracking a cost centre that
doesn't map to a team, tagging a tenant. Missing labels are a detected
finding with an owner, not a hard block, because blocking resource
creation on a label typo is a bad trade.

The third layer is the billing export into `prj-common-billing`, into
BigQuery, joined against the project-to-team registry. That join is
important: the registry is authoritative for ownership, so a project
that changed hands still attributes correctly historically because the
registry is versioned. Reporting off raw billing data alone loses
that.

Then there's shared cost, which is where most chargeback designs
quietly fail. Network hub, DNS, logging, CI/CD, the registry, KMS and
security tooling are consumed by everyone and owned by the platform
team. I'd allocate them with a published, boring rule — proportional
to each team's directly-attributed spend — and I'd resist the
temptation to build precise metering for it. Precise shared-cost
metering costs more engineering than it ever recovers in fairness, and
it turns every month into a dispute about the metering. A simple rule
everyone understands beats an accurate rule nobody trusts.

On chargeback versus showback, I'd start with showback and be explicit
that it's a deliberate stage, not a lack of ambition. Showback makes
the numbers visible and lets teams find the errors in them, which they
will, enthusiastically. After a couple of cycles where the numbers
survive scrutiny, chargeback becomes a finance decision rather than an
engineering risk. Going straight to chargeback with day-one data means
the first month's errors get argued about in a budget meeting.

Finally, alerts and reports are different instruments. Budgets with
threshold alerts fire in near-real-time to the owning team's channel;
they are an operational signal. The monthly report is a finance
artifact. Conflating them means finance gets paged and engineers get
spreadsheets, which is exactly backwards.

**Architecture**

```
   Hierarchy (structural attribution)        Labels (what hierarchy can't say)
   ─────────────────────────────────        ────────────────────────────────
   fldr-prod/fldr-prod-payments/             env, team, cost-center, app,
   prj-payments-ledger-prod   ◄── (1)        data-class, owner-group,
                                             lifecycle, [tenant]   ◄── (2)
              │                                        │
              └──────────────┬─────────────────────────┘
                             ▼
                 ┌────────────────────────┐
                 │  billing export →       │  ◄── (3)
                 │  BigQuery in            │
                 │  prj-common-billing     │
                 └───────────┬────────────┘
                             │  joined to versioned project→team registry (4)
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ direct cost    │  │ shared-services  │  │ discount/commit  │
│ per team       │  │ cost pool ◄── (5)│  │ benefit ◄── (6)  │
└───────┬────────┘  └────────┬─────────┘  └────────┬─────────┘
        │                    │  allocated pro-rata  │ distributed by the
        │                    │  to direct spend     │ same pro-rata rule
        └────────────────────┴──────────┬──────────┘
                                        ▼
                          ┌──────────────────────────┐
                          │  team cost of ownership   │
                          └────────┬─────────────────┘
              ┌──────────────────┬─┴──────────────────┐
              ▼                                       ▼
     budget alerts → team channel            monthly report → finance
     (operational, near-real-time) ◄── (7)   (financial truth) ◄── (8)

  Cross-cutting: labels are enforced by reconcile, not by blocking resource
  creation — a missing label is a detected finding with an owner (9).
```

**Every arrow explained:**

1. **Hierarchy as primary attribution** — project placement and naming
   attribute most spend before labels do anything. Wrong alternative:
   label-only attribution, which fails silently whenever a label is
   dropped.
2. **Mandatory label set** — covers what the hierarchy can't express:
   multiple apps in a project, cost centres that cross teams, tenant
   identity.
3. **Billing export to BigQuery in a dedicated project** — the
   analysis surface lives where no workload team can alter it.
4. **Join to a versioned project→team registry** — a project that
   changed owners still attributes correctly for past periods,
   because ownership history is preserved.
5. **Shared-services pool with a published pro-rata rule** — simple
   and understood beats accurate and disputed. Wrong alternative:
   per-team metering of the network hub, which costs more to build
   than it redistributes.
6. **Commitment and discount benefit distributed by the same rule** —
   otherwise the team whose workload happens to sit on a committed
   machine family gets an arbitrary windfall.
7. **Budget alerts as an operational signal** — near-real-time, to the
   owning team, not to finance.
8. **Monthly report as the financial artifact** — a different cadence,
   a different audience, a different accuracy bar.
9. **Label enforcement by reconcile, not by block** — blocking
   creation on a label typo trades a large friction cost for a small
   attribution gain.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Primary attribution | Hierarchy and project naming | Labels as the primary key | A resource can lose a label; it cannot lose its project | When one project deliberately hosts many teams' workloads — then labels must lead and you accept the fragility |
| Shared-cost allocation | Published pro-rata rule | Per-service metering | Understood and cheap; disputes drop to near zero | When one team's consumption of a shared service is genuinely an order of magnitude above the rest — then meter that one service only |
| Rollout | Showback first, chargeback after two cycles | Chargeback from day one | Lets teams find the data errors before money moves | When finance already has an approved allocation model and the data is inherited from a mature estate |
| Label enforcement | Detected and reconciled | Blocked at creation | Avoids failing a deploy over a typo in a reporting field | When a label carries a security meaning such as `data-class` — that one is worth blocking on |
| Reporting surface | BigQuery in a platform-owned project | Console billing reports per team | Joins to the ownership registry and supports the shared-cost model | When the org is small and the console's built-in views genuinely answer everything asked of them |

**What a weak answer sounds like**

- "We'd tag everything and build a dashboard." — labels alone, applied
  by convention, are never complete; the dashboard then reports a
  confident wrong number.
- "Each team gets their own billing account." — solves attribution by
  destroying the shared discount pool and the single-org view.
- "We'd allocate shared costs precisely." — precision here is an
  engineering programme that never pays for itself; the panel is
  listening for whether you'll choose boring over exact.
- "Finance can pull the numbers from the console." — no ownership
  history, no shared-cost model, no join to the registry.

**Common wrong turns**

- **Retrofitting labels.** Backfilling label coverage across a live
  estate is weeks of work with permanently incomplete history.
  Recover by enforcing at creation going forward and accepting that
  historical attribution starts from a date.
- **Blocking deploys on missing labels.** Feels rigorous, generates
  incidents over reporting metadata. Recover by moving all but
  `data-class` to detected.
- **Building chargeback before the data is trusted.** The first
  disputed invoice poisons the whole programme. Recover by explicitly
  naming showback as stage one with a date for stage two.
- **Letting cost alerts go to finance.** Finance can't act on them and
  engineers never see them. Recover by routing alerts to the owning
  group from the label, which the vending machine already knows.

**Follow-up probes the interviewer asks next**

1. **"A team says their bill is wrong. What do you do?"** — reproduce
   it from the export joined to the registry, and if the disagreement
   is about shared-cost allocation, point at the published rule rather
   than relitigating it. Most disputes are about the rule, not the
   data.
2. **"How do you get per-customer unit cost in the pooled tier?"** —
   you approximate it. Infrastructure cost divided by a usage
   proxy, published as an estimate, never as an invoice input. Anyone
   who promises exact per-tenant cost in a pooled runtime is
   overselling.
3. **"Who owns this in two years?"** — a FinOps function that sits
   between platform and finance, with the allocation rule as a
   published, versioned document. Unowned, the rule drifts and every
   month becomes a negotiation.
4. **"What breaks at 200 teams?"** — nothing structural; the
   shared-cost pool grows and the pro-rata rule gets more contentious.
   I'd expect to revisit the rule, not the architecture.
5. **"Escalate: a single team's spend triples overnight. What should
   have caught it?"** — the budget threshold alert, within hours, to
   their channel. If it took until month-end, the alerting layer isn't
   doing its job and the report is being asked to do an operational
   task.
6. **"How does this interact with commitments?"** — centrally
   purchased, benefit distributed by the same pro-rata rule. Letting
   teams buy their own commitments fragments the pool and produces
   worse aggregate coverage.

**Cross-references**

- `03-comparisons/01-compute-options.md` — the relative cost-model
  section and the discount-lever table back the commitment row; this
  file stays qualitative by design.
- `D1-Q05` for label enforcement at creation; `D1-Q09` for who acts on
  these numbers once they exist.

---

### D1-Q09 — "You've got cost visibility. Now design the operating model. Who sees cost, who acts on it, and what does the architecture have to emit for that to work?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 4.2, 4.3 |
| **Axis** | structure |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D1-Q08` |

**What the interviewer is actually testing**

Whether you can design a human process with the same rigour as an
infrastructure one — roles, triggers, escalations, artifacts — and
whether you understand that the architecture has obligations to that
process. This is a process question and the diagram should be a
process, not a box diagram.

**Clarifying questions to ask before drawing anything**

- **Does anyone currently have authority to turn something off?** If
  cost reduction requires a VP's approval every time, no operating
  model will work and the real problem is delegation.
- **Is cost a team objective or a central one?** If teams aren't
  measured on it, visibility changes nothing and I'd design for
  central action instead of distributed action.
- **What's the ratio of efficiency waste to architectural waste?**
  Rightsizing is a team action; choosing a fundamentally cheaper
  service is an architecture action. Different owners, different
  cadences.
- **Is there an engineering culture of reverting cost changes when
  something breaks?** If a rightsizing caused an incident once, the
  appetite is gone and the model needs a safety story.
- **Who signs off on commitments?** Commitment purchasing is a
  centralised, forecast-driven decision and needs a named owner.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Cost data exists and is trusted | Stated (from `D1-Q08`) | — | The model assumes attribution is settled |
| Teams have some budget authority | Assumed | "Visibility without authority just generates complaints" | Determines whether teams are actors or spectators |
| Central function exists | Assumed | "I'll assume a small FinOps function, not a department" | Sets the escalation target |
| Architecture must emit signals | Stated | — | Tagging, unit metrics and idle detection become platform features |
| Monthly financial cadence, faster operational one | Assumed | "Two clocks, not one" | Separates anomaly response from optimisation cycles |

**The answer, out loud**

I'd separate three loops that run at different speeds, because
collapsing them into one monthly meeting is why most FinOps programmes
stall.

The fast loop is anomaly response, measured in hours. A budget
threshold or a rate-of-change alert fires to the owning team's channel
— derived from the `owner-group` label, so no routing table is
maintained. The team's own on-call triages it exactly like an
availability alert: is this expected, is it a bug, is it an attack.
The only escalation is if nobody acknowledges, in which case it goes
to the team's engineering manager. The architecture's obligation here
is that every resource is attributable and every team has a channel
the platform already knows about.

The middle loop is efficiency, measured in weeks. This is
rightsizing, idle resource reclamation, storage class transitions,
committed-use coverage gaps — the mechanical stuff. It's driven by
recommender output and platform-generated reports, and it's owned by
the teams with a central function tracking aggregate progress rather
than filing the individual changes. The architecture's obligation is
to emit the recommendations in a form a team can act on without
analysis: not "this project is expensive" but "this specific instance
group has been under ten percent utilised for thirty days and here is
the change."

The slow loop is architectural, measured in quarters. This is where
you notice that a workload's cost per unit of business value is
structurally wrong — that it belongs on a different service, a
different storage class, a different region, or shouldn't exist. It's
owned jointly by architecture and the team, it feeds the roadmap, and
it's the only loop where the answer is allowed to be "rewrite
something." The architecture's obligation here is the hardest one:
emit a unit-cost metric. Cost per order, per tenant, per transaction —
something that lets a team see cost trending against value rather than
against last month.

On who acts: teams act, always, for their own resources. The central
function owns three things only — the allocation rule, commitment
purchasing, and the aggregate number that goes to leadership. I'd be
firm that the central function does not make changes in teams'
projects, because a central team turning off other people's resources
is how FinOps becomes adversarial and stops getting cooperation.

The escalation I'd design explicitly is the stalemate: a team has a
known inefficiency, has been told, and hasn't acted, usually because
the fix competes with feature work. That's not a cost problem, it's a
prioritisation problem, and it escalates to whoever owns the team's
roadmap with the number attached. What I would not do is let the
central function fix it unilaterally.

Last, the safety story, because it's what actually determines
participation. Every cost action has to be revertible and every
rightsizing has to be staged through non-prod. One cost-driven
incident sets the programme back a year, and engineers are right to
be cautious. I'd rather capture eighty percent of the savings safely
than a hundred percent with an outage attached.

**Architecture**

```
  ┌─────────────────────────── FAST LOOP: hours ──────────────────────────┐
  │                                                                        │
  │  budget/rate-of-change alert                                           │
  │        │  routed by owner-group label  ◄── (1)                         │
  │        ▼                                                               │
  │  team channel ──► team on-call triages ──► expected? bug? attack?      │
  │        │                                        │                      │
  │        │ no ack in 4h                           ▼                      │
  │        └──────────► eng manager            revert / fix / accept       │
  └────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────── MIDDLE LOOP: weeks ─────────────────────────────┐
  │  recommender + platform report  ◄── (2)                                │
  │        │  "this MIG, <10% util, 30 days, here is the change"           │
  │        ▼                                                               │
  │  team backlog ──► staged in nonprod ──► applied  ◄── (3)               │
  │        │                                                               │
  │        │ not actioned in 2 cycles                                      │
  │        ▼                                                               │
  │  STALEMATE ESCALATION → roadmap owner, with the number  ◄── (4)        │
  └────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────── SLOW LOOP: quarters ──────────────────────────────┐
  │  unit-cost metric (cost per order / tenant / transaction)  ◄── (5)     │
  │        │                                                               │
  │        ▼                                                               │
  │  architecture + team review ──► roadmap item  ◄── (6)                  │
  └────────────────────────────────────────────────────────────────────────┘

  CENTRAL FinOps FUNCTION owns exactly three artifacts:  ◄── (7)
    allocation rule  |  commitment purchasing  |  the aggregate number
  It does NOT make changes inside teams' projects.  ◄── (8)

  Cross-cutting: every cost action must be revertible and rehearsed in
  nonprod first — one cost-driven incident ends voluntary participation (9).
```

**Every arrow explained:**

1. **Alert routing derived from the `owner-group` label** — no routing
   table to maintain, so it can't go stale. Wrong alternative: a
   central cost team triaging every alert, which doesn't scale past a
   handful of teams and puts triage furthest from context.
2. **Recommendations emitted as specific, actionable changes** — the
   platform's obligation is to remove the analysis step. "This project
   is expensive" is not actionable; a named resource with a utilisation
   history and a proposed change is.
3. **Staged through non-prod** — cost changes get the same rollout
   discipline as any other change, because they are changes.
4. **Stalemate escalation to the roadmap owner** — an un-actioned
   inefficiency is a prioritisation decision, not a cost failure, and
   it escalates to whoever can prioritise.
5. **Unit-cost metric as the slow loop's input** — the only signal
   that distinguishes "expensive because we grew" from "expensive
   because it's wrong." This is the architecture's hardest obligation
   and the one most often skipped.
6. **Architectural findings become roadmap items** — the slow loop's
   output is a funded piece of work, not a recommendation nobody owns.
7. **Central function's three artifacts** — deliberately narrow.
   Everything else is a team responsibility.
8. **Central function does not act inside teams' projects** — the
   moment it does, FinOps becomes adversarial and teams stop
   volunteering information.
9. **Revertibility as the participation guarantee** — the safety story
   is what determines whether engineers cooperate at all.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Who acts | Teams, always | Central function makes changes | Context lives with the team; central action breeds adversarial dynamics | When a team has been dissolved and its resources are orphaned — then central reclamation is the only option |
| Loop structure | Three loops at different speeds | One monthly cost review | Anomalies need hours; architecture needs quarters; one cadence serves neither | When the estate is small enough that a single monthly review genuinely covers all three |
| Alert routing | Derived from labels | Maintained routing table | Cannot go stale, because it's the same label cost attribution uses | When alerts must reach a rota rather than a team — then an integration with the paging system, still keyed off the label |
| Escalation for inaction | To the roadmap owner | To the central cost function | It's a prioritisation problem and needs someone who can reprioritise | When the inefficiency is also a security or compliance issue — then it escalates on that axis instead, faster |
| Safety | Revert-first, rehearse in non-prod | Move fast, capture more savings | One cost incident ends voluntary participation for a year | When the resource is provably idle and unattached — then act directly, the rehearsal adds nothing |

**What a weak answer sounds like**

- "We'd have a monthly cost review meeting." — one cadence for three
  problems; anomalies are stale and architecture never gets discussed.
- "The FinOps team will optimise the estate." — centralised action
  without context, and it stops teams sharing information.
- "We'd show teams their spend and they'll fix it." — visibility
  without authority, without actionable detail, and without an
  escalation path produces complaints, not savings.
- "We'd set hard budget caps per team." — caps cause outages when a
  legitimate growth event hits, and the first time that happens
  they're removed permanently.

**Common wrong turns**

- **Making cost a central team's job.** It's the most natural
  organisational move and it removes the only people with context.
  Recover by narrowing the central function to the three artifacts.
- **Skipping the unit-cost metric because it's hard.** Without it,
  every cost conversation is month-over-month and growth looks
  identical to waste. Recover by picking one crude proxy and shipping
  it rather than designing the perfect one.
- **Conflating the anomaly alert with the monthly report.** Finance
  gets paged, engineers get spreadsheets. Recover by separating
  audiences explicitly.
- **No stalemate path.** Known inefficiencies sit forever and the
  programme loses credibility. Recover by defining the escalation
  before the first stalemate, not after.

**Follow-up probes the interviewer asks next**

1. **"A team refuses to act on a recommendation. What happens?"** — it
   escalates to their roadmap owner with the number and the
   recommendation attached, and then it's a business decision that
   someone owns explicitly. "Accepted, with an expiry date" is a valid
   outcome; silence isn't.
2. **"How do you avoid this becoming a witch hunt?"** — the central
   function reports aggregate numbers, not league tables, and never
   acts in teams' projects. Ranking teams by spend punishes the team
   running the biggest workload.
3. **"Who owns this in two years?"** — a FinOps function of two or
   three people, with the allocation rule as its most important
   artifact. If it grows to a department, it has started doing teams'
   work for them.
4. **"What does the architecture have to emit that it doesn't
   today?"** — unit-cost metrics and idle-resource detection with
   enough specificity to act on. Both are platform features, not
   reports, and both need engineering time allocated.
5. **"Escalate: leadership wants thirty percent out of the bill this
   quarter."** — the fast and middle loops can't deliver that; only
   the slow loop can, and it doesn't move in a quarter. The honest
   answer is a mix of commitment restructuring, environment
   consolidation and a named set of workload decisions, presented with
   what each costs in engineering time.
6. **"What's the first metric that tells you this is working?"** —
   time from anomaly to acknowledgement, not total savings. Savings
   lag; participation doesn't.

**Cross-references**

- `03-comparisons/01-compute-options.md` — relative cost model and
  discount levers; the middle loop's recommendations draw on it.
- `D1-Q08` for the attribution this model consumes; `D1-Q16` for how
  the slow loop's findings enter the governance cadence.

---

### D1-Q10 — "We now operate in six countries, three of which have data residency laws. How do you do that without ending up with six separate platforms?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.2, 1.3 |
| **Axis** | structure |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D1-Q03` |

**What the interviewer is actually testing**

Whether you can separate the data plane, which must be regional, from
the control plane, which mostly needn't be — and whether you'll press
on what "residency" actually requires in each jurisdiction rather than
applying the strictest interpretation everywhere.

**Clarifying questions to ask before drawing anything**

- **For each country, is the requirement storage location, processing
  location, or operator access?** Storage-only is an Org Policy
  constraint. Processing is harder. Operator access restrictions are
  the hardest and change the support model entirely.
- **Does metadata count?** Logs, traces and billing records often
  contain personal data. If they're in scope, the central logging
  design in `D1-Q01` needs a regional variant and that's a significant
  change.
- **Are backups and disaster-recovery copies in scope?** Almost always
  yes, and it's the most commonly missed part — a DR copy in a
  neighbouring region can quietly break residency.
- **Is there a named framework, or just a law?** A named framework
  with a compliance programme behind it changes the tooling answer.
- **Do customers in these countries need to interoperate?** If a
  multinational customer has entities in two restricted countries,
  the tenant model has to handle a tenant that spans jurisdictions.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Six countries, three with residency law | Stated | — | Three restricted, three not — the unrestricted three share everything |
| Storage residency at minimum | Stated | — | `constraints/gcp.resourceLocations` at the jurisdiction folder |
| Backups in scope | Assumed | "I'll assume DR copies count as data at rest — they almost always do" | Constrains DR region pairing per jurisdiction |
| Logs may contain personal data | Assumed | "I'd want this confirmed early, because it decides whether logging stays central" | Determines central vs regional sink topology |
| One codebase, one pipeline | Assumed | "I'm assuming we're not forking the product per country" | Forces the fork into deployment, not code |

**The answer, out loud**

The framing I'd open with is that residency is a property of data, not
of a platform. The mistake that produces six platforms is treating the
country as the unit of replication — six copies of everything,
including six copies of the CI system, six control planes, six on-call
rotations. What I want instead is one control plane and N data planes,
where N is the number of distinct jurisdictional requirements, not the
number of countries.

So the first thing I'd do is collapse six countries into a smaller
number of jurisdiction groups. Three countries have no residency law —
they share one multi-region data plane. The three restricted ones need
examining individually, and it's common for two of them to have
compatible requirements that let them share a regional deployment. I'd
say out loud that I expect to end up with two or three data planes,
not six, and that getting that number down is the single highest-value
piece of analysis in this whole design.

Structurally, each jurisdiction group gets a folder under the
production environment with `constraints/gcp.resourceLocations`
pinned to its permitted regions. That constraint is the load-bearing
control: it makes a resource in the wrong region impossible to create,
not merely detectable, and it inherits to every project below. Beneath
that folder sit the workload projects for that jurisdiction, with
their own datastores, their own key ring in-region, and their own
backup destinations — all constrained by the same policy, so backups
can't leak across the boundary even by misconfiguration.

The control plane stays central and singular. The source repository,
the build pipeline, the artifact registry, the deployment tooling, the
policy catalogue, the team registry — these hold configuration and
code, not customer data, and there's no residency argument for
splitting them. What's regional is the deployment *target*. One
pipeline promotes the same artifact into each jurisdiction's projects,
with the jurisdiction's own key and its own configuration. That's the
design's central claim: the fork is in the deployment topology, not in
the product.

Logging is where I'd expect the argument. Central logging is enormously
valuable operationally and it's also the place personal data leaks
into a place it shouldn't be. My default is a two-tier split: audit
and platform telemetry — who did what to which resource — flows to the
central sink in `prj-common-logging` because it's about operators and
infrastructure, not customers. Application logs that may contain
customer data stay in-jurisdiction, in a regional sink, with only
aggregated metrics leaving. That gives central observability for
platform health and keeps customer data local. If a jurisdiction's law
is strict enough that even audit metadata can't leave, then that
jurisdiction gets a regional audit sink too, and I'd flag that as a
real operational cost rather than pretending it's free.

The AI angle is worth one sentence because it comes up: if any part of
the product sends customer data to a model, the model endpoint's
region and the training-data retention terms are both in residency
scope, and that has to be pinned per jurisdiction the same way storage
is. I'd raise it rather than wait to be asked.

Finally, the thing that decays: region pinning is easy to establish
and easy to erode. A new managed service gets adopted, it isn't
available in the restricted region, someone gets an exception "just for
staging," and the boundary is soft within a year. So the residency
constraint is one of the very few I'd put in the enforced tier
permanently, with exceptions requiring legal sign-off rather than
architecture sign-off.

**Architecture**

```
  CONTROL PLANE — single, central, no customer data       ◄── (1)
  ┌──────────────────────────────────────────────────────────────┐
  │ source repo │ prj-common-cicd │ prj-common-registry │ policy  │
  └───────────────────────────┬──────────────────────────────────┘
                              │  same artifact promoted to each
                              │  jurisdiction  ◄── (2)
    ┌─────────────────────────┼─────────────────────────┐
    ▼                         ▼                         ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ fldr-prod-juris-A│  │ fldr-prod-juris-B│  │ fldr-prod-juris-C│
│ (3 unrestricted  │  │ (restricted #1)  │  │ (restricted #2+3,│
│  countries)      │  │                  │  │  compatible) ◄─(3)│
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ resourceLocations│  │ resourceLocations│  │ resourceLocations│
│  = multi-region  │  │  = [region-b]    │  │  = [region-c]    │ ◄── (4)
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ datastore        │  │ datastore        │  │ datastore        │
│ key ring         │  │ key ring in-reg  │  │ key ring in-reg  │ ◄── (5)
│ backups          │  │ backups in-reg   │  │ backups in-reg   │
│ regional app log │  │ regional app log │  │ regional app log │ ◄── (6)
└─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘
          │ audit + platform telemetry only            │
          └─────────────────────┬─────────────────────┘
                                ▼
                   prj-common-logging (central)  ◄── (7)

  Cross-cutting: six countries collapse to three jurisdiction groups —
  reducing that number is the highest-value analysis here (8); any model
  endpoint handling customer data is pinned per jurisdiction like storage
  is (9); residency exceptions require legal sign-off, not architecture
  sign-off, because this boundary erodes quietly (10).
```

**Every arrow explained:**

1. **Single central control plane** — repo, build, registry and policy
   hold code and configuration, not customer data. Wrong alternative:
   a CI system per country, which multiplies operational cost with no
   compliance benefit anyone asked for.
2. **Same artifact promoted everywhere** — the product doesn't know
   which jurisdiction it's in; configuration does. This is what stops
   the fork reaching the codebase.
3. **Jurisdiction groups, not countries** — compatible requirements
   share a data plane. Six countries becoming three groups is the
   difference between a tractable platform and six of them.
4. **`constraints/gcp.resourceLocations` at the jurisdiction folder** —
   preventive, inherited, and unbypassable from below. Wrong
   alternative: detecting misplaced resources after creation, which
   means the violation existed.
5. **In-region key ring per restricted jurisdiction** — key material
   location is frequently in scope even when compute isn't; pairing
   the key with the data is what makes crypto-shredding a
   jurisdiction-local guarantee.
6. **Regional application log sink** — application logs may carry
   customer data and stay local; only aggregated metrics leave.
7. **Central sink for audit and platform telemetry** — operator
   actions and infrastructure health are about us, not customers, so
   central observability survives.
8. **Collapsing six to three** — analysis, not architecture, and the
   highest-leverage work in the question.
9. **Model endpoints in residency scope** — region and data-retention
   terms both count; raise it unprompted rather than discovering it in
   a review.
10. **Legal sign-off for exceptions** — the only control I'd make
    harder to except than to enforce, because erosion here is silent
    and the consequence is regulatory.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Unit of separation | Jurisdiction group | One deployment per country | Collapses six data planes to three; ops cost scales with groups, not flags | When two countries' laws look compatible but diverge on operator access — then separate, because the divergence is in the part that's hard to retrofit |
| Control plane | Single and central | Per-jurisdiction control plane | No customer data in it, so no residency claim on it | When a jurisdiction restricts operator nationality or location — then the control plane genuinely must be regional for that one |
| Logging | Two-tier: central audit, regional application | Fully central | Keeps observability while keeping customer data local | When a jurisdiction's law covers audit metadata too — then that jurisdiction gets a regional audit sink and you absorb the operational cost |
| Enforcement of region pinning | Enforced Org Policy constraint | Detected and remediated | A residency violation that existed is already a reportable event | When a jurisdiction is preferential rather than legal — then detect, and don't pay the exception-process cost |
| Exception authority | Legal sign-off | Architecture sign-off | The consequence is regulatory, not technical | When the exception is confined to synthetic test data with no customer content — then architecture can decide |

**Making it concrete**

```hcl
resource "google_folder_organization_policy" "residency" {
  folder     = "folders/FOLDER_ID"          # fldr-prod-juris-B
  constraint = "constraints/gcp.resourceLocations"
  list_policy {
    allow { values = ["in:REGION_VALUE"] }
  }
}
```

Attaching this at the jurisdiction folder rather than per project is
what makes a new project in that jurisdiction compliant on creation —
which is the same argument as `D1-Q01`, applied where the consequence
of getting it wrong is a regulator rather than an incident.

**What a weak answer sounds like**

- "We'd deploy the whole platform in each country." — six control
  planes, six on-call rotations, six CI systems, and no compliance
  requirement asked for any of it.
- "Residency just means picking the right region." — it means storage,
  processing, backups, keys, logs and sometimes operator access; naming
  that list is most of the credibility here.
- "We'd use the strictest requirement everywhere." — sounds safe and
  penalises the unrestricted majority with regional constraints they
  don't need, including losing multi-region durability.
- "Logs are just operational data." — application logs routinely
  contain personal data; this sentence is where residency programmes
  most often fail their first audit.

**Common wrong turns**

- **Forgetting DR copies.** A cross-region backup pair configured for
  durability quietly moves data out of jurisdiction. Recover by
  checking every backup destination against the same constraint that
  governs primary storage.
- **Splitting the control plane reflexively.** Doubles operational
  cost for no requirement. Recover by asking which specific control
  plane component holds customer data — usually none do.
- **Treating each country as its own group.** Six of everything.
  Recover by doing the jurisdiction-compatibility analysis before
  drawing anything.
- **Granting a staging exception to the residency constraint.** It's
  the first crack and it never closes. Recover by giving restricted
  jurisdictions their own staging inside the same constraint, even
  though it costs more.

**Follow-up probes the interviewer asks next**

1. **"A multinational customer has entities in two restricted
   countries. How does your tenant model handle it?"** — as two
   tenants with a shared commercial relationship, not one tenant
   spanning jurisdictions. Trying to make one tenant record span
   restricted jurisdictions is where the data model breaks.
2. **"A new managed service you want isn't available in one restricted
   region. What now?"** — the jurisdiction doesn't get that feature,
   or it gets a different implementation. What it doesn't get is an
   exception to the location constraint; feature parity is not worth
   the boundary.
3. **"How do you prove compliance to a regulator?"** — the constraint
   itself as preventive evidence, the dry-run and enforcement history
   showing continuous coverage, and audit logs showing no resource was
   created outside the permitted set. Preventive evidence is stronger
   than detective evidence here.
4. **"Who owns this in two years?"** — a compliance-engineering
   function jointly with legal, with the jurisdiction-group mapping as
   a maintained artifact. Laws change; the mapping must be someone's
   job to re-derive.
5. **"Escalate: what happens if a fourth country adds a residency
   law?"** — it either joins an existing compatible group, or it
   becomes a new group, which is a folder, a constraint, a key ring
   and a deployment target. That it's a bounded, repeatable amount of
   work is the whole point of the design.
6. **"What breaks if the central control plane goes down?"** — nobody
   can deploy anywhere, in any jurisdiction. That's a real
   concentration and it's the price of not forking; it makes the
   control plane's own availability a first-class concern, which is
   `D1-Q13`.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the compliance
  mechanism matrix (manual assembly vs Assured Workloads) and the
  encryption control matrix back the key-location rows.
- `01-domains/DOMAIN-3-security-compliance.md` §3.2 — regulatory
  mapping detail this answer deliberately doesn't restate.
- `D1-Q03` for the T4 sovereign tier this design implements.

---

### D1-Q11 — "A team comes to you with a genuine need for something your Org Policy forbids. Walk me through what happens."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 3.1, 4.2 |
| **Axis** | structure |
| **Whiteboard time** | 25–35 min |
| **Reads well after** | `D1-Q06` |

**What the interviewer is actually testing**

Whether your guardrails have a designed escape hatch or an undesigned
one. Every platform has exceptions; the question is whether they're
recorded, scoped and expiring, or whether they're a Slack message to
whoever has the permission. This is a process question — the diagram
should be a decision flow.

**Clarifying questions to ask before drawing anything**

- **Is the need genuine, or is it a workaround for a platform gap?**
  If three teams have asked for the same exception, the platform is
  wrong and the answer is a feature, not an exception.
- **What's the time pressure?** An exception needed for a launch
  tomorrow and one needed for a roadmap item next quarter get
  different paths, and pretending otherwise means the urgent one
  bypasses the process entirely.
- **Can the need be met a different way at similar cost?** Most
  exception requests have an alternative the team didn't know about.
- **Who carries the risk if we grant it?** If the answer is "the
  platform team," the incentives are wrong; the requesting team's
  leadership should own the accepted risk.
- **Is the constraint regulatory or internal?** Regulatory constraints
  don't have an architecture exception path at all — they have a legal
  one, and conflating the two is dangerous.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Exceptions must be possible | Stated | — | A platform with no exception path grows shadow infrastructure |
| Exceptions must expire | Assumed | "I'd make every exception time-boxed by default; permanence is the thing that kills guardrails" | Forces re-justification instead of drift |
| Exceptions must be scoped narrowly | Assumed | "Scoped to a project or folder, never granted at the org node" | Requires policy attached below the org node — `D1-Q06`'s design |
| Risk is owned by the requester | Assumed | "The platform team shouldn't carry risk for a decision it didn't need" | Determines who signs |
| Repeat exceptions become features | Assumed | "Three of the same request is a platform gap" | Creates the feedback loop |

**The answer, out loud**

I'd say first that the existence of this path is what makes the
guardrails credible. A platform where the only answers are "yes" and
"no, forever" gets routed around within months — teams build in
sandboxes, or in a personal account, or they find the one person who
can flip the constraint. So the exception path isn't a weakness in the
governance model, it's load-bearing.

The flow starts with triage, and the first question isn't "should we
grant this" — it's "is this actually an exception." A lot of requests
are a team not knowing the supported way to do the thing. So the first
step is an architect conversation, not a form, and a meaningful
fraction ends there with an alternative the team is happy with. I'd
keep that step lightweight and fast, because if it feels like a
gate people will skip it.

If it is a genuine exception, the next fork is regulatory versus
internal. If the constraint exists because a regulator requires it —
residency, for instance — there is no architecture exception path.
It goes to legal and compliance, and the answer is usually no. I'd be
explicit about that fork because blurring it is how an engineering
decision quietly becomes a compliance breach.

For internal constraints, the exception is granted as a narrow,
expiring, recorded change: policy attached at the specific project or
team folder, never loosened at the org node, with an expiry date and a
named risk owner who is the requesting team's leadership, not the
platform team. The record lives in the same repository as the policy
catalogue, so the exception and the constraint it excepts are visible
together. Compensating controls get attached where they exist — if a
team needs an external IP, they get it with a firewall policy and
enhanced logging, not bare.

The expiry is the part I'd defend hardest. Default ninety days,
renewable with a fresh justification. Not because ninety days is
magic, but because a permanent exception is indistinguishable from a
constraint that shouldn't exist, and the renewal is the only moment
anyone ever re-examines it. Teams hate it initially and then mostly
stop noticing, because renewal is cheap when the need is still real.

The last piece is the feedback loop, which is the part that makes this
a design rather than a queue. Every exception is tagged with the
constraint it excepts. When the same constraint accumulates several
exceptions, that's evidence and it goes into the cadence in `D1-Q16` —
either the constraint gets demoted to detected, or the platform builds
a supported path for the underlying need. Without that loop the
exception register grows forever and the platform learns nothing.

The urgent case deserves its own answer because it's where processes
actually fail. For a genuine production emergency, the break-glass
path exists: an on-call platform engineer can grant a scoped exception
immediately, it pages, and it auto-expires in twenty-four hours with a
mandatory retrospective. Designing that path explicitly is what stops
the emergency becoming the permanent bypass.

**Architecture**

```
  team hits a denied action
         │
         ▼
  ┌──────────────────────────────┐
  │ (1) TRIAGE — architect convo,  │   many requests end here with a
  │     not a form. "Is there a    │──► supported alternative the team
  │     supported way to do this?" │    didn't know about
  └──────────────┬───────────────┘
                 │ genuine exception
                 ▼
  ┌──────────────────────────────┐
  │ (2) FORK: regulatory or        │
  │     internal constraint?       │
  └───────┬──────────────┬───────┘
          │ regulatory   │ internal
          ▼              ▼
  ┌───────────────┐   ┌────────────────────────────────────┐
  │ legal +       │   │ (4) SCOPED GRANT                    │
  │ compliance    │   │  • attached at project/team folder  │
  │ NO architect- │   │    — never at the org node          │
  │ ure exception │   │  • compensating controls attached   │
  │ path ◄── (3)  │   │  • expiry ≤ 90 days, renewable      │
  └───────────────┘   │  • risk owner = requesting team's   │
                      │    leadership, not platform ◄── (5) │
                      └──────────────┬─────────────────────┘
                                     ▼
                      ┌────────────────────────────────────┐
                      │ (6) recorded in the policy repo     │
                      │     next to the constraint it       │
                      │     excepts; tagged by constraint   │
                      └──────────────┬─────────────────────┘
                                     ▼
                      ┌────────────────────────────────────┐
                      │ (7) FEEDBACK: n exceptions on one   │
                      │  constraint → demote it, or build   │
                      │  a supported path. Goes to D1-Q16.  │
                      └────────────────────────────────────┘

  URGENT PATH (production emergency only):  ◄── (8)
    platform on-call grants scoped exception immediately → pages →
    auto-expires in 24h → mandatory retrospective. Designed explicitly
    so the emergency never becomes the permanent bypass.  ◄── (9)
```

**Every arrow explained:**

1. **Triage as a conversation, not a form** — a large share of
   requests resolve into a supported alternative. Wrong alternative: a
   ticket form, which converts a five-minute conversation into a
   two-week queue and teaches teams to avoid it.
2. **Regulatory/internal fork** — the single most important branch,
   because it determines whether architecture has authority at all.
3. **No architecture exception for regulatory constraints** — it goes
   to legal, and the answer is usually no. Blurring this is how an
   engineering decision becomes a compliance breach.
4. **Scoped grant below the org node** — the constraint stays enforced
   everywhere else. This is why `D1-Q06` attaches policy at
   environment folders rather than the org node in the first place.
5. **Risk owner is the requesting team's leadership** — the platform
   team should not carry risk for a decision it didn't need made.
6. **Exception recorded beside the constraint** — visible together,
   in the same repository, so nobody reads the policy without seeing
   its exceptions.
7. **Feedback loop on exception count** — repeat exceptions are
   evidence that the constraint or the platform is wrong; this is what
   makes the register a signal rather than a graveyard.
8. **Explicit break-glass for emergencies** — immediate, paging,
   24-hour auto-expiry, mandatory retrospective.
9. **Designed urgency path** — if the only path is slow, the urgent
   case becomes the permanent bypass. Designing it is cheaper than
   discovering it.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Entry point | Architect conversation | Request form | Most requests dissolve into a supported alternative in minutes | When request volume exceeds what conversation can absorb — then a form that triages into a conversation, not instead of one |
| Grant scope | Project or team folder | Loosen the constraint org-wide | Everyone else stays protected | When the exception turns out to apply to every team — that's not an exception, that's a wrong constraint; demote it |
| Duration | Expiring by default, ≤90 days | Permanent with annual review | Renewal is the only moment anyone re-examines it | When the exception reflects a permanent architectural fact, such as a legacy system with a funded decommission date — then tie expiry to that date |
| Risk ownership | Requesting team's leadership | Platform or security team | Aligns incentive with the party who wants the exception | When the exception is granted for the platform's own convenience — then platform owns it, honestly |
| Emergency path | Explicit break-glass with auto-expiry | Same process, expedited | An expedited normal process is still too slow at 3am and gets bypassed | When there is genuinely no production yet — then there is no emergency path to design |

**What a weak answer sounds like**

- "We wouldn't grant exceptions." — every platform grants exceptions;
  claiming otherwise says the ones you grant aren't recorded.
- "They'd raise a ticket and we'd review it." — no fork for
  regulatory, no expiry, no scope, no feedback loop; it's a queue, not
  a design.
- "We'd turn the constraint off for them." — turning it off is org-wide
  unless the policy was attached below the org node, which is why the
  hierarchy design and this process are the same decision.
- "Security decides." — makes security the bottleneck and the risk
  owner for a decision it didn't want, which reliably produces a
  culture of avoidance.

**Common wrong turns**

- **Making the path slow to discourage use.** Teams route around it
  instead, and you lose visibility of the exceptions that exist.
  Recover by optimising for recording over discouraging.
- **Granting permanence for a big customer or a big deadline.** It
  always feels justified in the moment and it's how the register
  becomes fiction. Recover by granting a longer expiry rather than
  none.
- **No tagging by constraint.** The register grows and nobody can see
  which constraint is generating friction. Recover by tagging
  retroactively; it's a small job and it feeds `D1-Q16`.
- **Treating a regulatory constraint as negotiable.** The worst
  failure mode in this question. Recover immediately and visibly if
  you catch yourself doing it mid-answer.

**Follow-up probes the interviewer asks next**

1. **"A VP escalates and demands the exception be permanent. What do
   you do?"** — grant a longer expiry with their name as the risk
   owner, recorded. The escalation is legitimate; permanence without a
   named owner isn't.
2. **"How many open exceptions is too many?"** — it's not a count,
   it's a distribution. Many exceptions spread thinly is a healthy
   platform; many exceptions against one constraint is a broken
   constraint. That distribution is the metric I'd watch.
3. **"Who owns this process in two years?"** — platform architecture
   runs it, security co-signs the risky classes, and the register is a
   standing agenda item in the governance cadence. Unowned, it becomes
   a spreadsheet nobody opens.
4. **"Escalate: what's the blast radius of a badly scoped
   exception?"** — if it was granted at the org node instead of the
   folder, it's the entire estate, silently. That's the single
   highest-consequence mistake in this process and it's why the grant
   mechanism is mechanised rather than manual.
5. **"What if the team just builds it in a sandbox instead?"** — then
   the process failed, and I'd treat a sandbox workload carrying real
   data as an incident rather than a policy violation. The sandbox's
   isolation from the perimeter is what keeps that recoverable.
6. **"Does the break-glass path get abused?"** — it gets measured. If
   break-glass use isn't rare and correlated with real incidents, the
   normal path is too slow and that's the thing to fix, not the
   break-glass path.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — Org Policy inheritance
  and the "can only tighten, never loosen" row explain why the scoped
  grant must attach below the org node.
- `D1-Q06` for the tiering that determines which constraints even
  have an exception path; `D1-Q16` for where the feedback loop lands.

---

### D1-Q12 — "There's already an organization with four hundred projects and no governance. You can't start over. Now build the landing zone."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.4, 3.1 |
| **Axis** | structure |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you can build governance incrementally against a moving
target, and whether you'll resist the two failure modes: a big-bang
remediation that never lands, and a parallel "new world" that nobody
migrates into.

**Clarifying questions to ask before drawing anything**

- **Is anything actively on fire?** A public bucket with customer data
  or an exported service-account key in a repository jumps the queue
  ahead of any structural work.
- **How many of the 400 projects are actually alive?** In an
  ungoverned estate, typically a large fraction are dead or
  experimental. Discovering that first can shrink the problem
  dramatically.
- **Is there political sponsorship, and how long does it last?** This
  work outlives most sponsorship, so I want to sequence visible wins
  early.
- **Can I change anything about how new projects are created today?**
  Stopping the bleeding is the cheapest intervention and it's
  independent of everything else.
- **Are there projects nobody will admit to owning?** There always
  are, and the plan needs a defined path for them that isn't "delete
  and find out."

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| 400 existing projects, no hierarchy | Stated | — | Projects likely sit directly under the org node |
| Cannot start over | Stated | — | Rules out a greenfield org and a mass migration |
| Production workloads are live | Assumed | "I'll assume some of these are revenue-critical and can't tolerate policy surprises" | Forces detect-before-enforce sequencing |
| Ownership is partly unknown | Assumed | "In an ungoverned estate, ownership is always partly unknown" | Requires a discovery phase before any folder moves |
| New projects still being created | Assumed | "If creation isn't controlled, the problem grows while you fix it" | Makes vending the first intervention |

**The answer, out loud**

I'd sequence this in four phases, and the ordering is the answer — the
components are the same as `D1-Q01`, it's the order and the
reversibility that differ.

Phase one is stop the bleeding, and it's the only phase with a hard
deadline. Two things: project creation moves behind the vending
machine so that no new ungoverned project can appear, and the org-level
audit log sink gets created so that from this date forward we have a
record. Neither of these touches a single existing project, which is
why they can ship in weeks rather than quarters. I'd emphasise that
sequencing, because most brownfield programmes start by trying to fix
what exists and never get to the tap that's still running.

Phase two is discovery, and I'd resist the urge to skip it. Every
project gets inventoried: who has IAM on it, what's actually running,
what it costs, when it was last deployed to, what data class it looks
like it holds. Ownership gets derived from IAM bindings and billing
and deployment activity, then confirmed with humans. The output is a
triage exactly like `D1-Q02`'s — retire, retain, adopt, rebuild — and
in an ungoverned estate I'd expect a genuinely large retire bucket.
Shrinking 400 to the 250 that matter is the highest-leverage work
available and it's mostly analysis.

Phase three is the hierarchy, built around what exists rather than
beside it. I create the folder structure — environments, then teams —
and then I *move projects into it*, which is a cheap operation and
reversible. Crucially I create the folders with policy in detect mode
first: a project moves into `fldr-prod-payments` and inherits nothing
enforced yet, but everything it violates becomes a finding with an
owner. That way a move never causes an outage, and the violation list
arrives before the enforcement does.

Phase four is enforcement, per constraint, per folder, on a published
schedule. Each constraint goes dry-run, then a remediation window
where the finding list is worked, then enforced. The order matters:
I'd start with the constraints whose violations are rarest, because
early wins are cheap and they build the credibility to do the
expensive ones. Service-account key creation is usually the hard one
and I'd do it late, with a real migration to federated identity
underneath it.

The parallel-universe failure mode is worth naming explicitly. The
tempting alternative is to build a clean new organization and invite
teams to migrate. It fails because migration is always someone else's
priority, so you end up operating two estates indefinitely, and the
ungoverned one keeps the interesting workloads. Building governance
around the existing estate is slower and less satisfying and it's the
one that finishes.

For the projects nobody owns: they go into a quarantine folder with
IAM reduced to read-only and a notification to everyone who has ever
touched them. If nothing happens in a defined window, they get stopped
but not deleted — resources off, data retained — and deleted only
after a much longer window. I'd never delete an unowned project
outright, because the one time it matters it's a quarterly financial
process nobody documented.

**Architecture**

```
  PHASE 1 — stop the bleeding (weeks, touches nothing existing) ◄── (1)
    project creation  ──► vending machine (D1-Q05)
    org-level audit sink ──► prj-common-logging
                     │
                     ▼
  PHASE 2 — discovery and triage (analysis)  ◄── (2)
    400 projects ──► inventory: IAM, spend, deploy activity, data class
                 ──► ownership derived, then human-confirmed  ◄── (3)
                 ──► retire (large) | retain | adopt | rebuild
                     │
                     ▼
  PHASE 3 — hierarchy, built around what exists  ◄── (4)
    org node                     org node
     ├── prj-x  (400 flat)  ──►   ├── fldr-prod ── fldr-prod-<team> ── prj-x
     ├── prj-y                    ├── fldr-nonprod ── ...
     └── ...                      ├── fldr-quarantine ── unowned  ◄── (5)
                                  └── fldr-common
    policy attached in DETECT mode only — a move never causes an outage (6)
                     │
                     ▼
  PHASE 4 — enforcement, per constraint, on a published schedule ◄── (7)
    dry-run ──► remediation window ──► enforced
    rarest violations first (cheap wins build credibility)  ◄── (8)

  Cross-cutting: every project move is individually reversible (9); the
  parallel-clean-org alternative is rejected explicitly — migration is
  always someone else's priority and you end up running two estates (10).
```

**Every arrow explained:**

1. **Phase 1 touches nothing existing** — that's why it ships in
   weeks. Controlling creation and starting the audit record are both
   independent of remediation. Wrong alternative: starting with
   remediation while ungoverned projects keep appearing.
2. **Discovery before structure** — you cannot place a project in a
   team folder without knowing whose it is.
3. **Ownership derived then confirmed** — IAM, billing and deployment
   activity give a strong first guess; humans confirm. Asking humans
   first produces silence.
4. **Hierarchy built around the estate, not beside it** — projects
   move into folders, which is cheap and reversible.
5. **Quarantine folder for unowned projects** — read-only IAM, notify,
   then stop resources, then eventually delete. Never delete outright.
6. **Detect-mode policy on arrival** — a move generates findings, not
   outages. This is the single decision that makes phase three safe to
   run continuously.
7. **Per-constraint enforcement on a published schedule** — teams can
   plan against it, which is what turns enforcement from an ambush
   into a project.
8. **Rarest violations enforced first** — cheap early wins buy the
   credibility needed for the expensive constraints later.
9. **Per-project reversibility** — same property as `D1-Q02`, and the
   reason this can proceed without a cutover event.
10. **Explicit rejection of the parallel clean org** — naming the
    alternative and why it fails is part of the answer, because it's
    the option leadership will suggest.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Overall approach | Govern the existing org in place | Build a clean org and migrate | Migration is always deprioritised; you end up operating two estates | When the existing org is genuinely small or is being decommissioned on a funded date anyway |
| First action | Control new project creation | Remediate the worst existing projects | The tap is still running; remediation against a growing estate never converges | When something is actively exploited — then remediate that one thing first, then close the tap |
| Policy on folder arrival | Detect mode | Enforce on move | A move can't cause an outage, so moves can proceed continuously | When the estate is small and known-clean, or the constraint is closing an active exploit |
| Enforcement order | Rarest violations first | Highest-risk first | Early wins buy the political capital for the expensive constraints | When a high-violation constraint is the one an auditor is actively asking about — then do it first and accept the cost |
| Unowned projects | Quarantine, stop, then delete on a long clock | Delete after notice | The one unowned project that matters is always a quarterly process nobody documented | When the project provably holds no data and has had no activity for a long, verifiable period |

**What a weak answer sounds like**

- "We'd build a new organization properly and migrate everyone." — the
  parallel-universe failure; the panel has usually seen it fail.
- "We'd apply the org policy baseline and fix what breaks." — that's
  an outage across an estate you don't understand yet.
- "First we'd document everything." — discovery matters, but doing it
  before closing the creation tap means documenting a moving target.
- "We'd delete anything without an owner." — correct-sounding and the
  one action with an irreversible failure mode.

**Common wrong turns**

- **Remediating before controlling creation.** The estate grows while
  you fix it and the programme never converges. Recover by shipping
  the vending machine first even if it's minimal.
- **Enforcing on folder move.** One move causes an outage and every
  team refuses to be moved. Recover by switching to detect mode; the
  political damage is worse than the delay.
- **Skipping the retire bucket.** You spend remediation effort on
  dead projects. Recover by re-running triage — activity data makes
  this fast.
- **Letting discovery become a permanent project.** Perfect inventory
  is unattainable in an ungoverned estate. Recover by timeboxing
  discovery and letting quarantine absorb the unknown remainder.

**Follow-up probes the interviewer asks next**

1. **"How long does this take?"** — phase one in weeks, phase two in a
   couple of months, phases three and four running continuously for
   somewhere between two and four quarters depending on violation
   density. I'd commit to phase one's date and give ranges for the
   rest, because committing to a remediation date before discovery is
   how these programmes lose credibility.
2. **"A team refuses to be moved into a folder."** — detect mode means
   the move costs them nothing, so refusal is usually about trust
   rather than risk. If it persists, the move happens anyway because
   the folder is a policy boundary, not a claim on their work — but
   I'd spend the conversation first.
3. **"Who owns this in two years?"** — the platform team, and by then
   it should be indistinguishable from the greenfield operating model
   in `D1-Q01`. If a "migration programme" still exists in two years,
   it has become permanent.
4. **"Escalate: what's the biggest risk in this plan?"** — sponsorship
   outlasting the work. That's why phase one ships fast and why
   enforcement starts with cheap wins; the plan needs to show visible
   progress before the sponsor's attention moves.
5. **"What if you find customer data in a project with no owner?"** —
   that's an incident, not a governance finding. It leaves the
   quarantine path and goes to security immediately.
6. **"How do you avoid the enforcement schedule slipping forever?"** —
   publish it, attach each constraint to a named owner, and report
   against it in the governance cadence. A schedule nobody reports
   against is a wish.

**Cross-references**

- `03-comparisons/04-migration-strategies.md` — the triage buckets are
  the 6 R's applied at project rather than application granularity.
- `D1-Q02` for the acquisition variant of the same problem; `D1-Q05`
  for phase one's vending machine; `D1-Q06` for the detect-then-
  enforce tiering phase four depends on.

---

### D1-Q13 — "Draw me your shared-services projects. Then tell me what happens when each one fails."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 2.1, 6.2 |
| **Axis** | structure |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you've thought about the platform as a dependency rather than
a convenience. Every shared service is a single point of failure for
forty teams, and the skill is knowing which ones fail loudly, which
fail silently, and which you can afford to have fail at all.

**Clarifying questions to ask before drawing anything**

- **What's the availability expectation of the workloads on top?** A
  platform can't be less available than the things depending on it,
  and if teams are targeting high availability the shared services
  need their own regional story.
- **Which shared services are in the request path versus the change
  path?** DNS is in the request path — its failure is an outage. CI is
  in the change path — its failure blocks deploys but not traffic.
  That distinction drives everything else.
- **Is there an existing on-prem dependency that shares fate?** A DNS
  forwarder or an identity provider on-prem can make a cloud-native
  design fail for reasons nobody drew.
- **Who is on call for the platform?** If nobody, the shared services
  need to fail toward "keeps working" rather than "needs an operator."
- **How long can deploys be blocked before it's an incident?** Usually
  longer than people think, which is useful licence to simplify the CI
  design.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| One project per shared concern | Stated (from `D1-Q01`) | — | Independent blast radius per concern |
| Some services are request-path | Assumed | "DNS and the network hub are in the request path; the rest aren't" | Different availability targets per service |
| Platform has an on-call | Assumed | "If it doesn't, everything here needs to degrade gracefully instead" | Determines failure-mode design |
| Teams can't self-host alternatives | Assumed | "Otherwise teams will route around a fragile platform, which is worse" | Raises the bar on request-path services |
| Change freeze is survivable | Assumed | "A CI outage is painful, not an outage" | Permits a simpler CI availability story |

**The answer, out loud**

I'd split the shared services into two groups before drawing anything,
because they have genuinely different availability requirements and
treating them uniformly over-engineers half and under-engineers the
other half.

The request-path group is the network hub and DNS. If the Shared VPC
host project's routing breaks, or if `prj-common-dns` stops resolving,
production traffic fails for every team simultaneously. These get the
strongest treatment: separate change windows from everything else,
staged rollout of any change through non-prod first, redundant
Interconnect or VPN paths, and — the part people skip — a documented
answer to "what works if this is down." For DNS specifically, cached
resolution buys minutes, not hours, so the recovery objective is
genuinely tight.

The change-path group is CI/CD, the artifact registry, and the policy
pipeline. If these fail, nothing in production stops; deploys stop.
That's serious but it's a different class of serious, and I'd
deliberately not spend the engineering budget making them
multi-regional. What I would do is make sure a failure is recoverable
without them — that a previously-deployed artifact can be re-rolled
out, and that an emergency rollback doesn't require the build system.
An incident where you can't roll back because the registry is down is
the failure mode that turns a change-path outage into a request-path
one.

Then there are the evidence services: logging, security posture, and
billing export. Their failure is silent, which makes them the most
dangerous in a specific way. Nothing breaks, nobody notices, and three
weeks later you discover the audit trail has a hole in it. So these
get monitored for *absence* — an alert if log volume drops below an
expected floor, not just if an error appears. That inverted alerting
is the design point I'd make sure to say out loud, because it's the
one that distinguishes someone who's operated a platform from someone
who's designed one.

KMS sits on its own because it's both request-path and catastrophic. A
key that becomes unavailable makes data unreadable, and the failure
modes include ones you cause yourself — a bad IAM change, an
accidental key destruction schedule. So KMS gets the strictest change
control of anything on the diagram, key destruction requires a long
mandatory delay, and access to the key project is elevation-only.

The overall design principle I'd state is that shared services should
fail toward "keeps working" rather than "needs an operator." A DNS
zone that keeps serving stale records is better than one that refuses
to answer. A policy pipeline that can't run leaves existing policy in
place rather than removing it. Designing the failure direction is
usually cheaper than designing the failure away.

**Architecture**

```
  REQUEST PATH — failure = production outage for all 40 teams  ◄── (1)
  ┌────────────────────────────┐   ┌────────────────────────────┐
  │ prj-common-nethub-prod      │   │ prj-common-dns              │
  │ Shared VPC host, Cloud      │   │ private zones, on-prem      │
  │ Router, NAT, hier. firewall │   │ forwarding, DNS peering     │
  │ redundant IC/VPN paths      │   │ cache buys minutes, not hrs │
  │ separate change window (2)  │   │ separate change window (2)  │
  └────────────────────────────┘   └────────────────────────────┘

  CHANGE PATH — failure = deploys stop, traffic doesn't  ◄── (3)
  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
  │ prj-common-cicd  │ │ prj-common-      │ │ policy pipeline   │
  │                  │ │ registry         │ │ (leaves existing  │
  │                  │ │ + BinAuthz       │ │  policy in place) │
  └──────────────────┘ └──────────────────┘ └──────────────────┘
        must remain possible: re-roll a previously-built artifact
        and roll back WITHOUT the build system  ◄── (4)

  EVIDENCE — failure is SILENT, which is the danger  ◄── (5)
  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
  │ prj-common-      │ │ prj-common-scc   │ │ prj-common-      │
  │ logging          │ │                  │ │ billing          │
  └──────────────────┘ └──────────────────┘ └──────────────────┘
        alert on ABSENCE: log volume below floor, findings stale,
        billing export gap — not just on errors  ◄── (6)

  CATASTROPHIC — prj-common-kms  ◄── (7)
        strictest change control on the diagram; key destruction has a
        long mandatory delay; access is elevation-only (D1-Q07)

  Design principle: every shared service fails toward "keeps working"
  rather than "needs an operator" (8). Stale DNS beats no DNS; stale
  policy beats no policy; a queued build beats a lost one (9).
```

**Every arrow explained:**

1. **Request-path group** — network hub and DNS; their failure is an
   immediate multi-team production outage. Wrong alternative: treating
   them with the same change process as CI, which is how a routine
   change becomes a company-wide incident.
2. **Separate change windows for request-path services** — never
   changed in the same window as anything else, so an incident has an
   unambiguous cause.
3. **Change-path group** — deploys stop, traffic continues.
   Deliberately not multi-regional, because the engineering budget
   buys more elsewhere.
4. **Rollback must not depend on the build system** — an outage where
   you can't roll back is how a change-path failure becomes a
   request-path one.
5. **Evidence group fails silently** — nothing breaks and the gap is
   discovered weeks later during an audit.
6. **Alert on absence, not just on error** — log volume below a floor,
   stale findings, a gap in billing export. This is the design point
   that separates operated platforms from designed ones.
7. **KMS as its own category** — both request-path and catastrophic,
   with self-inflicted failure modes; strictest change control and a
   long destruction delay.
8. **Fail toward "keeps working"** — designing the failure direction
   is cheaper than designing the failure away.
9. **Concrete degradations** — stale DNS, stale policy, queued builds.
   Each is a deliberate choice about what the service does when it
   can't do its job properly.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Project granularity | One project per concern | One consolidated platform project | Independent blast radius and per-concern IAM | When the platform team is tiny and the operational overhead of many projects exceeds the isolation benefit |
| Availability investment | Heavy on request path, light on change path | Uniform high availability everywhere | Buys the most resilience per unit of engineering | When a regulatory obligation requires deploy capability continuously — rare, but it exists for some incident-response commitments |
| CI/CD regionality | Single region, recoverable | Multi-region CI | A deploy freeze is survivable; the budget buys more on the request path | When deployment is itself the mitigation for a regional outage — then CI must survive the region it's mitigating |
| Evidence monitoring | Alert on absence | Alert on errors | Silent failure is the actual failure mode for logging and billing | When the service genuinely errors loudly on failure — some do, and then absence alerting is redundant noise |
| Key access | Elevation-only, long destruction delay | Standing access for the platform team | The self-inflicted failure modes are the realistic ones | When an automated process must rotate keys on a schedule — then a scoped service identity, still not standing human access |

**What a weak answer sounds like**

- "They're all highly available." — uniform treatment means either
  over-spending on CI or under-spending on DNS; the panel wants the
  distinction.
- "If CI goes down we just wait." — true for deploys and false for
  rollback; the follow-up is always about the rollback path.
- "Logging is fine, it's managed." — the failure mode is a
  misconfigured sink or a permissions change, not the service, and
  it's silent.
- "One platform project keeps it simple." — converts several
  independent failure domains into one and makes least privilege
  impossible.

**Common wrong turns**

- **Changing DNS and the network hub in the same window as everything
  else.** Attribution becomes guesswork during the incident. Recover
  by separating windows, which costs nothing.
- **Making rollback depend on a rebuild.** Discovered at the worst
  possible time. Recover by verifying that a previously-built artifact
  can be redeployed without the build system — it's a test you can
  run today.
- **Only alerting on errors for evidence services.** Recover by adding
  volume-floor alerts; they're cheap and they catch the real failure.
- **Standing human access to the key project.** Recover by moving it
  to elevation-only, which `D1-Q07`'s model already supports.

**Follow-up probes the interviewer asks next**

1. **"`prj-common-dns` is down. Walk me through the next thirty
   minutes."** — cached resolution holds briefly, existing connections
   survive, new resolution fails progressively. The response is
   restore-from-declared-state rather than debug-in-place, which is
   why the zones are in Terraform and not the console.
2. **"How does this scale to 200 teams?"** — the request-path services
   need sharding well before that; the Shared VPC host and DNS become
   per-region or per-business-unit. The evidence services scale fine;
   the change-path services need capacity, not architecture.
3. **"Who owns this in two years?"** — the platform team, with an
   on-call rotation and published service levels for each shared
   service. Shared services without a stated service level get
   depended on as if they were perfect.
4. **"Escalate: what's the worst single failure on this diagram?"** —
   the key project, because its failure modes include permanent data
   loss and some of them are self-inflicted. Everything else is
   recoverable.
5. **"What if a team wants to run their own DNS to reduce their
   dependency?"** — that's a signal the platform's reliability isn't
   trusted, and I'd treat it as feedback rather than as a violation.
   Fragmented DNS is worse than a shared dependency, so the fix is the
   shared service's reliability, not a rule against alternatives.
6. **"How do you test these failure modes?"** — deliberately, in
   non-prod, on a schedule, including the ones that are inconvenient.
   A failure direction you've never exercised is a hypothesis.

**Cross-references**

- `03-comparisons/03-networking-connectivity.md` — hybrid DNS
  resolution patterns and the Shared VPC row back the request-path
  group's design.
- `03-comparisons/05-ha-dr-strategies.md` — the availability tiering
  this answer applies to platform services rather than workloads.
- `D1-Q04` for the network topology; `D1-Q07` for elevation-only key
  access.

---

### D1-Q14 — "Separate projects, separate folders, or separate organizations for dev, staging and production? Defend it."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.3, 3.1 |
| **Axis** | structure |
| **Whiteboard time** | 25–35 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you can defend a boundary choice on its actual mechanism —
what each level of separation buys and what it costs operationally —
rather than reciting "separate environments" as a principle. The
separate-organizations option is the interesting one, because it's
wrong for most companies and right for a specific few.

**Clarifying questions to ask before drawing anything**

- **What is the separation protecting against — accident, malice, or
  an auditor?** Accident is solved by projects. Malice needs identity
  and perimeter separation. An auditor may need something you can
  point at, which sometimes argues for stronger structure than the
  risk alone does.
- **Does non-production ever contain production data?** If yes,
  everything tightens and the boundary has to be real rather than
  conventional. If genuinely never, dev can be much looser.
- **How many environments are there really?** Most orgs say three and
  have five, including a performance environment and a
  customer-demo environment that nobody governs.
- **Do the same people operate all three?** If production is operated
  by a different group, that's an identity boundary and it changes the
  IAM design more than the resource hierarchy does.
- **Is there a regulator who requires demonstrated separation of
  duties?** That can push toward structure that's visible in an audit
  artifact.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Three environments | Stated | — | Three folder subtrees, three Shared VPC hosts |
| Production data never in dev | Assumed | "I'd enforce this rather than assume it — `data-class` label plus perimeter" | Determines how loose dev can be |
| Same identity provider throughout | Assumed | "Separate orgs would still share the IdP, which is why they buy less than people think" | Weakens the separate-org argument |
| Teams deploy to all three | Assumed | "If a separate group runs production, IAM changes more than hierarchy does" | Elevation model rather than structural change |
| One billing account | Assumed | "Separate orgs fragment the discount pool" | A real cost of the separate-org option |

**The answer, out loud**

My answer is folders within one organization, with separate projects
beneath, and I'd defend it by walking what each level actually buys.

Separate projects are non-negotiable and they're the level that does
most of the work. A project is the IAM boundary, the quota boundary,
the billing boundary and the blast-radius boundary. Two environments
in one project means a dev deploy can exhaust production's quota, a
dev service account can be granted production access by accident, and
cost attribution is guesswork. So whatever else happens, prod and
non-prod are different projects. That part isn't a judgment call.

Folders are what turn many projects into a governed environment. The
folder is where Org Policy attaches, where hierarchical firewall
policy attaches, where IAM for the environment's roles is bound, and
where the audit log configuration is inherited from. With environment
folders I write the production policy set once and it covers every
production project including ones that don't exist yet. That last
clause is the whole argument: folders make the environment's rules
apply to future projects automatically, which is what stops drift.

Separate organizations are the option I'd argue against for most
companies, and I'd be specific about why rather than just saying it's
heavy. A separate org gives you a separate policy root, which folders
already give you. It does not give you separate identity, because
you'll federate the same identity provider into both — so the
"different people" benefit is illusory unless you also run separate
IdPs, which almost nobody does. What it definitely gives you is
fragmented billing and commitment pools, duplicated shared services,
duplicated vending and policy pipelines, and cross-org operations for
anything that has to span environments, like promoting an artifact.
That's a lot of permanent cost for a boundary folders already provide.

The cases where I'd actually choose separate organizations are narrow
and I'd name them: a legal entity that must be separable on short
notice, such as a business being prepared for divestiture; an
environment operated under a sovereignty regime where even the
organization node's administrators must be different people; and a
genuinely adversarial multi-tenant situation where a tenant's
administrators need org-level rights. Outside those, folders win.

On dev specifically, I'd make a distinction that often gets missed.
Dev being in the same organization does not mean dev is in the same
perimeter. Dev sits in the hierarchy for policy inheritance and cost
attribution, but it's outside the VPC Service Controls perimeter that
protects production data, and its `data-class` label set forbids
customer data. And separately from dev, there's a sandbox folder that
isn't part of the environment progression at all — time-boxed,
budget-capped, no hybrid route. Conflating sandbox and dev is how
ungoverned experiments end up inside the governed estate.

**Architecture**

```
  LEVEL 1 — separate PROJECTS (non-negotiable)  ◄── (1)
     IAM boundary │ quota boundary │ billing boundary │ blast radius

  LEVEL 2 — separate FOLDERS (the choice I'm defending)  ◄── (2)
  ┌────────────────────── one organization ─────────────────────────┐
  │                                                                  │
  │  fldr-prod          fldr-nonprod         fldr-dev                │
  │   ├ policy set P     ├ policy set N       ├ policy set D  ◄─ (3) │
  │   ├ hier. firewall   ├ hier. firewall     ├ hier. firewall       │
  │   ├ Shared VPC host  ├ Shared VPC host    ├ Shared VPC host      │
  │   ├ IAM: elevation   ├ IAM: standing      ├ IAM: standing        │
  │   │   only (D1-Q07)  │                    │                      │
  │   └ inside VPC-SC    └ inside VPC-SC      └ OUTSIDE VPC-SC ◄ (4) │
  │      perimeter          perimeter            data-class forbids  │
  │                                              customer data       │
  │                                                                  │
  │  fldr-sandbox — NOT part of the progression  ◄── (5)             │
  │   time-boxed │ budget-capped │ no hybrid route │ outside all      │
  │                                                                  │
  │  fldr-common — shared services, spans all environments  ◄── (6)  │
  └──────────────────────────────────────────────────────────────────┘

  LEVEL 3 — separate ORGANIZATIONS (rejected, with named exceptions) ◄─ (7)
     buys:  separate policy root  ── folders already give you this
     costs: fragmented billing + commitments, duplicated shared services,
            duplicated vending/policy pipelines, cross-org promotion
     does NOT buy: separate identity — you federate the same IdP anyway (8)
     CHOOSE IT ONLY FOR: divestiture-ready entity │ sovereignty regime
            requiring different org admins │ tenant-held org rights  ◄─ (9)
```

**Every arrow explained:**

1. **Separate projects as the floor** — IAM, quota, billing and blast
   radius all scope to the project. Sharing a project across
   environments is the one option with no defence.
2. **Folders as the governed-environment boundary** — policy,
   hierarchical firewall, IAM and log configuration all attach here
   and apply to projects that don't exist yet.
3. **A distinct policy set per environment** — dev is deliberately
   looser than prod, which is only expressible if they're separate
   folders.
4. **Dev inside the hierarchy but outside the perimeter** — policy
   inheritance and cost attribution without being inside the data
   boundary. Wrong alternative: assuming hierarchy membership implies
   perimeter membership.
5. **Sandbox outside the progression** — not an environment, not a
   stage, no hybrid route. Conflating it with dev puts ungoverned
   experiments inside the estate.
6. **`fldr-common` spans environments** — shared services are not
   per-environment except where `D1-Q13` says they are (the network
   hosts).
7. **Separate organizations rejected** — the benefit it claims is one
   folders already deliver.
8. **Identity doesn't separate with the org** — the same IdP federates
   into both, so the "different people" argument only holds if you run
   separate IdPs, which almost nobody does.
9. **The three named exceptions** — divestiture readiness, sovereignty
   requiring different org administrators, and tenants holding
   org-level rights. Naming them is what makes the rejection
   credible rather than dogmatic.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Environment boundary | Folders in one org | Separate organizations | Same policy isolation without fragmenting billing, shared services and tooling | When an entity must be separable on short notice, or a regime requires different org administrators |
| Project separation | Always separate per environment | One project with environment-prefixed resources | Quota, IAM and blast radius all scope to the project | Never, for anything with a production environment — this is the one row with no legitimate alternative |
| Dev strictness | Looser policy, outside the perimeter | Same policy as production | Preserves iteration speed where the data risk is removed by other means | When dev legitimately needs production data for testing — then it isn't dev, it's a second production environment and must be governed as one |
| Sandbox | Separate top-level folder | A permissive project inside dev | Genuinely unrestricted experimentation without touching the perimeter | When compliance forbids any ungoverned environment — then no sandbox exists and dev absorbs the demand under governance |
| Shared VPC hosts | One per environment | One host for all environments | A non-prod network change can't affect production | When the org is small enough that a single host's operational simplicity outweighs the coupling |

**Making it concrete**

```hcl
# Same constraint, opposite policy, because the folders differ.
resource "google_folder_organization_policy" "dev_external_ip" {
  folder     = "folders/FOLDER_ID"          # fldr-dev
  constraint = "constraints/compute.vmExternalIpAccess"
  list_policy { allow { values = ["projects/PROJECT_ID"] } }
}
```

The dev folder permits what the prod folder denies, narrowly and by
project. Expressing that difference is exactly what the folder
boundary is for, and it's not expressible at all if environments share
a folder.

**What a weak answer sounds like**

- "Separate organizations, for maximum isolation." — maximum isolation
  of a policy root you already had, at the cost of everything shared;
  the panel will ask what identity separation you gained and there
  isn't an answer.
- "One project per team with environment-prefixed resources." — quota,
  IAM and blast radius all shared; the first noisy dev deploy proves
  it.
- "Dev, staging and prod are all governed identically." — sounds
  rigorous, removes the reason dev exists, and pushes experimentation
  into places you can't see.
- "Sandbox is just dev." — the ungoverned workload ends up inside the
  governed perimeter, which is the outcome the sandbox exists to
  prevent.

**Common wrong turns**

- **Choosing separate orgs to satisfy an auditor.** Auditors want
  demonstrated separation, which a folder plus its policy set
  demonstrates perfectly well. Recover by showing the policy artifact
  rather than escalating the structure.
- **Letting a fourth environment appear undesigned.** Performance and
  demo environments arrive without folders or policy. Recover by
  treating any new environment as a folder with its own policy set,
  not a project in dev.
- **Assuming hierarchy membership equals perimeter membership.**
  Recover by drawing the perimeter separately from the hierarchy;
  they're different boundaries.
- **Loosening production to match dev for consistency.** Consistency
  is not the objective; the environments have different risk
  profiles. Recover by defending the asymmetry explicitly.

**Follow-up probes the interviewer asks next**

1. **"A regulator asks you to demonstrate separation of duties between
   dev and prod. What do you hand them?"** — the folder policy sets,
   the IAM binding generation showing distinct groups per environment,
   and the elevation log showing production access was time-bound. All
   three are artifacts, not assertions.
2. **"What changes if the company is preparing to divest a business
   unit?"** — that unit moves toward its own organization, and I'd
   start by making its shared-service dependencies explicit, because
   those are what make separation slow.
3. **"Who owns this in two years?"** — platform, and the pressure will
   be from teams wanting a fourth and fifth environment. The answer
   isn't refusal, it's making a new environment cheap to create
   properly.
4. **"How does this scale to 200 teams?"** — folder depth is fine; the
   Shared VPC hosts shard first (`D1-Q04`). Environment count is
   independent of team count, which is one of the nicer properties of
   putting environment on top.
5. **"Escalate: what's the blast radius of a misapplied policy at
   `fldr-prod`?"** — every production project simultaneously. That's
   the cost of the consolidation and the reason for staged rollout
   through dev and non-prod first.
6. **"Someone wants production data in staging for a realistic load
   test."** — then staging becomes a production-class environment for
   that data, with production's policy set and perimeter membership,
   or the data gets synthesised. There's no third option that's
   honest.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — Org Policy's
  tighten-only inheritance is why folder-level policy is sufficient
  and org-level separation is redundant.
- `D1-Q01` for the hierarchy this defends; `D1-Q06` for the per-
  environment policy sets; `D1-Q13` for the per-environment network
  hosts.

---

### D1-Q15 — "Design tenant onboarding and offboarding as an automated lifecycle. When a customer leaves, how do you prove their data is gone?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 3.2, 4.1 |
| **Axis** | structure |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D1-Q03` |

**What the interviewer is actually testing**

Whether you design offboarding with the same rigour as onboarding.
Onboarding gets built because it blocks revenue; offboarding gets
improvised because nobody's waiting on it — and then a deletion
certificate has to be signed and nobody can produce evidence. This is
a process question and the diagram should be a lifecycle flow.

**Clarifying questions to ask before drawing anything**

- **What does the contract require — deletion, or return then
  deletion?** Return-then-delete adds an export step with its own
  retention question, and the export itself becomes data you now hold.
- **What's the retention obligation that competes with deletion?**
  Financial records often must be retained for years, which means
  "delete everything" is usually wrong and the real answer is
  selective.
- **Do backups count?** They always do in the contract and they're
  always the hard part, because a backup is immutable by design.
- **How long is the grace period after termination?** Customers
  reactivate more often than anyone expects, and deleting on day one
  turns a renewal into a rebuild.
- **Who signs the deletion certificate?** That person's evidence
  requirement is the actual specification for this whole design.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Deletion must be provable | Stated | — | Evidence is a first-class output, not a log query |
| Backups in scope | Assumed | "Contracts always include them and they're the hard part" | Forces the key-destruction approach over row deletion |
| Some records must be retained | Assumed | "Financial records usually outlive the customer relationship" | Deletion is selective, not total |
| Grace period before deletion | Assumed | "I'd want 30 days minimum — reactivation is common" | Suspension is a distinct state from deletion |
| Same pipeline for all tiers | Assumed (from `D1-Q03`) | "Steps are skipped per tier, never branched" | Prevents offboarding diverging per tier |

**The answer, out loud**

I'd design this as a state machine with four states, not as two
scripts, because the interesting behaviour is in the transitions and
in the states nobody thinks about.

Provisioning is the first state, and it's the easy one. A tenant
record is created, the tier from `D1-Q03` is assigned, and the
pipeline runs: for a pooled tenant that's a row and a key alias; for a
dedicated tenant it's a folder, a project, a datastore, a key ring, a
deploy target and a monitoring scope. Same pipeline, more steps
enabled. The output is a tenant manifest that records exactly what was
created and where — and that manifest is the thing that makes
offboarding possible, because offboarding is just walking it
backwards.

Active is the steady state, and the thing I'd build into it is drift
detection against the manifest. If a new datastore appears holding
tenant data and isn't in the manifest, we've just created a place we
won't delete from. Catching that continuously is far easier than
discovering it during an offboarding audit.

Suspended is the state people skip. Termination triggers suspension,
not deletion: access is revoked, processing stops, data remains. The
grace period runs here. This exists because reactivation is common and
because it separates the commercial event from the irreversible one.
I'd also use this state for non-payment, which is a different trigger
with the same mechanics.

Deleted is the terminal state, and here's where the tier taxonomy pays
off. For T2 and above, deletion is primarily key destruction: destroy
the tenant's CMEK key and every copy of their data — live, replicated
and backed up — becomes unreadable simultaneously, including the
backups I can't selectively edit. That's the single strongest
argument for per-tenant keys and it's worth saying plainly. Then
resource deletion follows: the project goes, the datastore goes, the
deploy target goes. For pooled T1 tenants, key destruction covers what
was encrypted with a tenant-scoped key and row deletion covers the
rest, with backup expiry as the long tail — and I'd be honest that the
T1 proof is weaker and that the backup horizon is the real deletion
date.

The retention carve-out runs alongside. Records under a legal or
financial retention obligation are copied to a retention store before
deletion, encrypted with a separate key that isn't destroyed, with
access restricted to a compliance role. That's a deliberate,
documented exception to deletion, and it needs to be in the contract
language rather than discovered afterwards.

The evidence output is the part I'd emphasise because it's the actual
question. The pipeline emits a deletion record: the manifest, the
timestamp and identity of each deletion action, the key destruction
confirmation, the list of retained records and the legal basis for
each, and the backup expiry date after which the last copy is
unrecoverable. That record is signed and stored outside the tenant's
own infrastructure, in `prj-common-logging`, because evidence stored
inside what you deleted isn't evidence.

**Architecture**

```
   ┌──────────────┐   contract signed
   │ PROVISIONING │◄──────────────────
   └──────┬───────┘
          │ one pipeline, tier-specific steps ENABLED not branched ◄─ (1)
          │  T1: row + key alias
          │  T2: + per-tenant datastore + CMEK key
          │  T3: + folder + project + deploy target + monitoring scope
          ▼
   ┌──────────────┐   emits TENANT MANIFEST — what exists, where  ◄── (2)
   │    ACTIVE    │
   └──────┬───────┘   drift detection vs manifest: a datastore not in
          │           the manifest is a place we won't delete from ◄─ (3)
          │ termination │ non-payment
          ▼
   ┌──────────────┐   access revoked, processing stopped, DATA REMAINS
   │  SUSPENDED   │   grace period runs here  ◄── (4)
   └──────┬───────┘   reactivation returns to ACTIVE — this is why the
          │           commercial event and the irreversible one differ
          │ grace expires
          ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  DELETED — walk the manifest backwards                        │
   │   step 1: retention carve-out FIRST  ◄── (5)                  │
   │           records under legal hold → retention store,         │
   │           separate key (never destroyed), compliance-only IAM │
   │   step 2: KEY DESTRUCTION  ◄── (6)                            │
   │           live + replicas + BACKUPS unreadable simultaneously │
   │   step 3: resource deletion — project, datastore, targets     │
   │   step 4: T1 tail — row deletion + backup expiry horizon ◄─(7)│
   └───────────────────────────┬──────────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  DELETION RECORD  ◄── (8)                                     │
   │   manifest │ per-action timestamp+identity │ key destruction  │
   │   confirmation │ retained records + legal basis │ backup       │
   │   expiry date after which the last copy is unrecoverable      │
   │   stored in prj-common-logging — OUTSIDE what was deleted (9) │
   └──────────────────────────────────────────────────────────────┘
```

**Every arrow explained:**

1. **One pipeline, steps enabled per tier** — a dedicated tenant runs
   the same pipeline with more steps. Wrong alternative: a branch per
   tier, which diverges silently and breaks offboarding first, because
   nobody tests the offboarding branch.
2. **Tenant manifest as the provisioning output** — records what was
   created and where. Offboarding is walking it backwards, which is
   only possible if it exists.
3. **Drift detection against the manifest** — an unmanifested
   datastore is a place deletion will miss. Catching it continuously
   beats discovering it during an audit.
4. **Suspended as a distinct state** — separates the commercial event
   from the irreversible one and handles reactivation, which is more
   common than anyone plans for.
5. **Retention carve-out before deletion** — records under legal hold
   move to a separate store with a key that is never destroyed. Doing
   this after deletion is impossible; doing it first is routine.
6. **Key destruction as the primary deletion mechanism** — makes live
   data, replicas and immutable backups unreadable at once. This is
   the strongest argument for per-tenant keys in `D1-Q03`.
7. **The T1 tail is honest** — pooled tenants get row deletion plus a
   backup expiry horizon, and the real deletion date is that horizon.
   Claiming otherwise is the thing that fails an audit.
8. **Deletion record as a first-class artifact** — the signed evidence
   the certificate is based on.
9. **Evidence stored outside the deleted estate** — evidence inside
   what you deleted isn't evidence.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Deletion mechanism | Key destruction first, resource deletion second | Row and object deletion only | Covers immutable backups and replicas simultaneously | When the tenant shares a key with others (T1) — then row deletion plus backup expiry is all that's available, and say so |
| Lifecycle states | Four, with an explicit suspended state | Active and deleted only | Reactivation is common; irreversible action needs a gate | When the contract mandates immediate deletion on termination — then suspension is a breach, not a courtesy |
| Pipeline shape | One pipeline, tier steps enabled | A pipeline per tier | The offboarding path stays exercised for every tier | When one tier's infrastructure is genuinely unrelated — but in this taxonomy it never is |
| Retention handling | Carve-out before deletion, separate key | Delete everything and rely on the backup for retrieval | Retrieval from backup after deletion is unreliable and often self-contradictory | When there is genuinely no retention obligation — then skip the step rather than building an empty store |
| Evidence location | Central logging project | Within the tenant's own project | Evidence must survive the deletion it documents | Never — this row has no legitimate alternative, which is why it's worth stating |

**What a weak answer sounds like**

- "We'd delete their data." — the panel wants the mechanism and the
  evidence, and the follow-up about backups is guaranteed.
- "Backups expire eventually, so it's fine." — true and insufficient;
  the contract asks for a date and a proof, not an eventuality.
- "Onboarding is automated, offboarding is a runbook." — the runbook
  has never been run end to end and the first real execution is under
  legal pressure.
- "We'd query the logs to prove deletion." — logs show actions
  attempted, not data absent, and if they're in the deleted project
  they're gone too.

**Common wrong turns**

- **Skipping the suspended state.** The first reactivation becomes a
  rebuild from backup. Recover by adding suspension before the first
  real termination, not after.
- **Deleting before the retention carve-out.** Irreversible and
  discovered by finance later. Recover by making the carve-out a
  blocking step in the pipeline.
- **Not producing a manifest at provisioning time.** Offboarding
  becomes discovery. Recover by generating manifests retroactively
  from the infrastructure state for existing tenants.
- **Storing evidence inside the tenant's project.** Recover
  immediately; it's a one-line change and a total failure if missed.

**Follow-up probes the interviewer asks next**

1. **"A pooled tenant demands proof of deletion. What do you actually
   send them?"** — the row-deletion record, the tenant-scoped key
   destruction if they had one, and the backup expiry date with an
   explicit statement that the last recoverable copy expires then. The
   honesty is the deliverable.
2. **"How do you test this?"** — synthetic tenants provisioned and
   offboarded on a schedule in non-prod, with the deletion record
   reviewed. An offboarding path that's only exercised in production
   is a hypothesis.
3. **"Who owns this in two years?"** — the same team that owns
   provisioning, deliberately, so that a change to onboarding can't
   silently break offboarding. Splitting them is how the manifest
   drifts.
4. **"Escalate: the customer's regulator wants deletion within
   seventy-two hours."** — that removes the grace period and makes key
   destruction the only viable mechanism, which means that customer
   must be T2 or above. It's a tier requirement, not a process tweak.
5. **"What if a tenant's data ended up in a shared analytics
   dataset?"** — that's a manifest gap, and it's the reason for drift
   detection. The honest answer is that anything not in the manifest
   is a deletion risk, and analytics pipelines are the most common
   source of it.
6. **"How does this scale to 5,000 tenants?"** — provisioning and
   deletion are both automated and independent, so volume is fine.
   What strains is the retention carve-out, which has per-tenant legal
   nuance; I'd standardise the carve-out categories in the contract
   template rather than handling them case by case.

**Cross-references**

- `03-comparisons/06-iam-security-models.md` — the encryption control
  matrix's "key destruction as an access-revocation lever" row is the
  mechanism this design leans on.
- `D1-Q03` for the tier taxonomy that determines which deletion
  mechanism is available; `D1-Q10` if the tenant is in a restricted
  jurisdiction.

---

### D1-Q16 — "How do you run architecture governance for forty teams without becoming the thing everyone waits on?"

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 4.2, 5.1 |
| **Axis** | structure |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D1-Q06` |

**What the interviewer is actually testing**

Whether you understand that a review board is a queue with a latency
and a throughput, and that most architecture decisions should never
enter it. At principal level they're also testing whether you can
design an organisational mechanism that survives you leaving.

**Clarifying questions to ask before drawing anything**

- **What decisions currently require approval, and how many are there
  per month?** If it's dozens, the scope is wrong. If it's two, the
  board isn't the bottleneck and the problem is elsewhere.
- **What's the cost of a bad decision here — reversible or not?**
  Reversible decisions should not be reviewed; that's the core
  filter.
- **Has a review ever changed an outcome?** If reviews consistently
  rubber-stamp, they're theatre and should be replaced with a record.
- **Who are the architects — a central function or embedded?** This
  determines whether governance is something done to teams or with
  them.
- **What happens today when someone skips the process?** If nothing,
  the process is already advisory and you should design accordingly.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Forty teams, one architecture function | Stated | — | Central review cannot scale to every decision |
| Some decisions are irreversible | Assumed | "Reversibility is the filter I'd use to decide what gets reviewed" | Defines the review scope |
| Teams have architects or leads | Assumed | "If not, the first investment is growing them, not building a board" | Determines whether delegation is possible |
| Decisions must be discoverable later | Assumed | "The record matters more than the meeting" | Makes the artifact the product |
| Governance must feed the platform | Assumed | "Otherwise the same decision gets made forty times" | Connects to `D1-Q06`'s catalogue |

**The answer, out loud**

I'd start by saying the goal isn't to review more; it's to make most
decisions not need reviewing. A governance function that measures
itself by review throughput has already lost.

So the first mechanism is a filter, and the filter is reversibility
plus blast radius. A decision that one team can undo in a sprint,
affecting only their own service, never enters governance — they
record it and move on. A decision that's expensive to reverse, or
that other teams will depend on, or that commits the company to a
vendor or a data model, goes to review. In practice that's a small
number of decisions per quarter, and being ruthless about the filter
is what keeps the latency low for the ones that matter.

The second mechanism is paved paths, which is where most of the
governance actually happens. If the platform ships a supported way to
do the common things — a service template, a data pipeline pattern, a
deployment shape — then hundreds of decisions get made once, centrally,
and consumed rather than re-litigated. A team choosing the paved path
doesn't need review because the review already happened when the path
was built. That's the highest-leverage form of governance available
and it doesn't feel like governance at all, which is why it works.

The third mechanism is the record. Every significant decision gets a
short written artifact — context, the options, the choice, the
consequence — stored in the same repository as the code it affects.
The record matters more than the meeting. In two years nobody
remembers the discussion; they need to know why a choice was made
before they reverse it. And the record is what lets governance operate
asynchronously: most reviews should be a comment thread on a document,
not a calendar slot.

For the decisions that do need synchronous discussion, I'd run a
small, fast cadence with a published SLA — a submission gets a
response within a week, always, and the meeting exists to resolve
disagreement rather than to approve agreement. If everyone agrees in
the document, it doesn't need the meeting. I'd also make the board
advisory by default with a narrow set of things it can actually block:
irreversible data decisions, anything crossing a compliance boundary,
and anything committing shared infrastructure. Everywhere else the
team decides and the board's dissent is recorded rather than binding.

The mechanism I'd add that most governance functions lack is a
feedback loop back into the platform. Every exception from `D1-Q11`,
every repeated review question, every paved path that teams keep
deviating from — these are signals. The standing agenda isn't
"approve things," it's "what did we learn from the last quarter's
decisions, and what should the platform do differently." That's what
turns governance from a toll booth into a product function, and it's
the answer to the question's actual premise.

And the part I'd say last because it's the hardest: the function has
to be measured on team outcomes, not on compliance with its own
process. Time to first deploy, exception rate, paved-path adoption.
If governance is measured on how many reviews it completes, it will
find more things to review.

**Architecture**

```
  DECISION ARRIVES
        │
        ▼
  ┌──────────────────────────────────────────────────────┐
  │ (1) FILTER: reversible in a sprint by one team, and   │
  │     nobody else depends on it?                        │
  └───────┬──────────────────────────────┬───────────────┘
          │ YES                          │ NO
          ▼                              ▼
  ┌───────────────────┐    ┌──────────────────────────────────────┐
  │ team decides,      │    │ (3) IS THERE A PAVED PATH?            │
  │ records it,        │    │  supported template / pattern /       │
  │ moves on  ◄── (2)  │    │  deployment shape already reviewed    │
  └───────────────────┘    └────────┬──────────────────┬──────────┘
                                     │ YES              │ NO
                                     ▼                  ▼
                        ┌──────────────────┐  ┌────────────────────────┐
                        │ consume it — the  │  │ (4) WRITTEN RECORD:     │
                        │ review already    │  │ context / options /     │
                        │ happened  ◄── (3) │  │ choice / consequence    │
                        └──────────────────┘  └───────────┬────────────┘
                                                           ▼
                                            ┌──────────────────────────┐
                                            │ (5) ASYNC REVIEW — comment│
                                            │ thread, SLA: response in  │
                                            │ one week, always          │
                                            └──────────┬───────────────┘
                                                       │ disagreement only
                                                       ▼
                                            ┌──────────────────────────┐
                                            │ (6) SMALL SYNC CADENCE    │
                                            │ resolves disagreement,    │
                                            │ does not approve agreement│
                                            │ CAN BLOCK only: irrevers- │
                                            │ ible data decisions,      │
                                            │ compliance boundaries,    │
                                            │ shared infra commitments  │
                                            │ elsewhere: advisory, with │
                                            │ dissent recorded  ◄── (7) │
                                            └──────────┬───────────────┘
                                                       ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │ (8) FEEDBACK INTO THE PLATFORM — the standing agenda                │
  │  exception clusters (D1-Q11) │ repeated review questions │          │
  │  paved paths teams keep deviating from → new paved path, or a       │
  │  constraint demoted (D1-Q06), or a platform feature funded          │
  └────────────────────────────────────────────────────────────────────┘

  Measured on: time to first deploy, exception rate, paved-path adoption.
  NOT on reviews completed — that metric creates more reviews.  ◄── (9)
```

**Every arrow explained:**

1. **Reversibility-and-blast-radius filter** — the first gate, and the
   one that keeps the queue short. Wrong alternative: reviewing by
   size or cost, which catches large-but-reversible work and misses
   small-but-permanent data decisions.
2. **Team decides and records** — the majority path. The record exists
   so the decision is discoverable, not so it can be approved.
3. **Paved path as pre-decided governance** — the highest-leverage
   mechanism, because the review happened once when the path was
   built. Wrong alternative: reviewing each team's identical choice
   independently.
4. **Written record before any review** — context, options, choice,
   consequence. The artifact outlives everyone in the discussion.
5. **Asynchronous review with a published SLA** — most reviews are a
   comment thread. The SLA is what makes teams willing to submit
   rather than route around.
6. **Small synchronous cadence for disagreement only** — if the
   document has consensus, the meeting is waste.
7. **Narrow blocking authority, advisory elsewhere** — the board
   blocks irreversible data decisions, compliance boundaries and
   shared-infrastructure commitments; everywhere else dissent is
   recorded, not binding.
8. **Feedback into the platform as the standing agenda** — exception
   clusters and repeated questions become paved paths, demoted
   constraints or funded features. This is what makes governance a
   product function.
9. **Measured on team outcomes** — reviews-completed is the metric
   that guarantees the bottleneck.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Review scope | Irreversible or cross-team only | All significant architecture decisions | Keeps latency low for the decisions that actually matter | When the organisation has just had a serious architectural failure and needs visible tightening for a period — time-box it |
| Authority | Advisory, with narrow blocking rights | Binding approval on everything in scope | Advisory with a recorded dissent gets better information than binding authority does | When a decision crosses a regulatory boundary — then binding, because the consequence isn't the team's alone to accept |
| Mode | Asynchronous by default | Scheduled review meeting | A meeting's throughput is fixed; a comment thread's isn't | When the disagreement is genuine and the document has stalled — that's exactly what the sync cadence is for |
| Primary output | The written record | The decision itself | In two years the record is what prevents a costly reversal | When speed genuinely dominates and the decision is reversible — then decide, and record briefly |
| Success metric | Team outcomes | Reviews completed, process compliance | Process-compliance metrics reliably generate more process | When the function is new and needs to demonstrate it exists — briefly, and then change the metric |

**What a weak answer sounds like**

- "We'd have an architecture review board that approves all designs." —
  a fixed-throughput queue in front of forty teams; the question is
  literally about avoiding this.
- "Architects are embedded so there's no bottleneck." — embedding
  helps and doesn't answer how cross-team decisions get made or
  recorded.
- "We'd document standards and expect teams to follow them." — a
  standards document with no paved path and no feedback loop is read
  once and then diverged from.
- "Governance is about ensuring compliance with our principles." —
  tells the panel this function will measure itself on its own
  process.

**Common wrong turns**

- **Scoping review by project size.** Large reversible projects
  consume the queue while a small, permanent data-model decision sails
  through. Recover by restating the filter as reversibility.
- **Making the board binding everywhere.** Teams stop bringing
  problems early, which is when the advice would have been worth
  something. Recover by narrowing blocking rights and publicising it.
- **No SLA.** Teams route around an unbounded queue and governance
  loses visibility of exactly the decisions it wanted. Recover by
  publishing a response time and honouring it even when the answer is
  "we need longer."
- **No feedback loop.** The same question gets reviewed forty times
  and the platform never changes. Recover by making the standing
  agenda about learning rather than approving.

**Follow-up probes the interviewer asks next**

1. **"A team ships something you'd have advised against. What do you
   do?"** — nothing punitive. I record the dissent, and if it goes
   badly it becomes a case study, and if it goes well it becomes a
   paved path. Punishing it guarantees the next one happens invisibly.
2. **"How do you know this is working?"** — paved-path adoption rising
   while review volume stays flat. That combination means teams are
   choosing the supported route rather than being routed through a
   queue.
3. **"Who owns this in two years, and what happens when you leave?"** —
   it has to be a mechanism, not a person. The filter, the SLA, the
   record format and the standing agenda all exist as written
   artifacts, and the rotating membership means no single architect is
   load-bearing. If it only works because I'm in the room, I've built
   a dependency, not a function.
4. **"Escalate: two senior teams fundamentally disagree and both have
   good arguments."** — the sync cadence exists for exactly this; the
   output is a decision with the losing argument recorded, and a
   revisit trigger — a named condition under which we'd reopen it.
   Unresolved disagreements don't get to stay unresolved.
5. **"What if leadership wants governance to be stricter after an
   incident?"** — time-box the tightening and name the exit criteria
   up front. Permanent tightening in response to a single incident is
   how review boards accumulate scope they never shed.
6. **"How does this interact with the platform team?"** — they're the
   same loop. Governance produces the signals; the platform builds the
   paved paths that make the next round of decisions unnecessary.
   Separating them is how you get standards nobody can follow.

**Cross-references**

- `D1-Q06` for the control catalogue this cadence promotes and demotes
  against; `D1-Q11` for the exception clusters that feed the standing
  agenda; `D1-Q09` for the slow loop whose findings arrive here.
- `01-domains/DOMAIN-4-analyzing-optimizing.md` §4.2 — the
  business-process framing this answer applies to architecture.

---

### D1-Q17 — "A vendor is offering us their landing zone accelerator. It would save us four months. Do we take it?"

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 1.1, 5.1 |
| **Axis** | structure |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D1-Q01` |

**What the interviewer is actually testing**

Whether you can make a build-versus-buy decision on the right axis.
The wrong axis is features. The right axis is which parts of this are
differentiating, which are commodity, and what the exit looks like —
plus whether you'll give an actual answer rather than "it depends."

**Clarifying questions to ask before drawing anything**

- **What exactly does the accelerator produce — code we own, or a
  running system they operate?** Generated code we own is a very
  different decision from a managed service we rent.
- **Can we read and modify the output?** An accelerator that produces
  opaque configuration is a dependency; one that produces our own
  Terraform is a head start.
- **Does it encode opinions we disagree with?** Every accelerator has
  a hierarchy and a naming scheme baked in. If ours is already decided
  and differs, adoption means either changing ours or fighting theirs
  forever.
- **What's the four months actually competing with?** If the platform
  team is otherwise idle, four months is cheap. If it's four months of
  delay on revenue-blocking work, the calculus inverts.
- **Who operates it in year two?** The accelerator builds it; someone
  runs it. If that's us and we didn't build it, we'll be operating
  something we don't understand during our first incident.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Four-month time saving claimed | Stated | — | Needs testing against what the four months costs us |
| We'll operate it ourselves | Assumed | "Unless they're operating it, we own the consequences of not understanding it" | Makes comprehensibility the dominant criterion |
| Output is Terraform we own | Assumed | "I'd make this a hard requirement of any deal" | Distinguishes head start from lock-in |
| Our hierarchy is already decided | Assumed (from `D1-Q01`) | "If it isn't, adopting theirs is much more attractive" | Determines the cost of their opinions |
| Team is small | Assumed | "Which is why four months is genuinely valuable" | Makes buy a serious option, not a straw man |

**The answer, out loud**

I'd give a real answer: yes, take it, for the commodity layers, on the
condition that the output is code we own and can read — and no, don't
take it for the layers that encode our specific operating model.

The reasoning is that a landing zone isn't one thing. It's three
layers with very different characteristics. The bottom layer is
commodity: the bootstrap, the hierarchy scaffolding, the baseline
policy set, the log sink wiring, the Shared VPC plumbing. None of this
is differentiating. Every company builds substantially the same thing
and the only prize for building it yourself is understanding it, which
is a real prize but a purchasable one. This is where the four months
lives and this is what I'd buy.

The middle layer is the operating model: the vending machine's
approval logic, the exception process, the IAM group model, the
labelling taxonomy, the cost-allocation rule. These encode decisions
about how our company works, and they're the things that will be
different at every company. An accelerator will have opinions here and
they'll be someone else's opinions. Adopting them means either
retrofitting our processes to a vendor's model or carrying permanent
divergence from the upstream they'll keep updating. I'd build this
layer, and I'd expect it to be most of the work anyway.

The top layer is the paved paths — service templates, deployment
shapes, data patterns. These are product-specific and no accelerator
can know them. Build, obviously.

So the decision isn't buy-or-build, it's where the seam goes. And the
conditions I'd attach to the buy are specific. The output must be
Terraform in our repository, readable and modifiable by us, with no
runtime dependency on the vendor's tooling. We must be able to stop
paying them and keep running — that's the exit test, and I'd ask them
to demonstrate it rather than assert it. And there must be a named
internal owner who understands the generated code before the
engagement ends, because the accelerator's real failure mode isn't bad
code, it's a platform nobody on staff can reason about during an
incident.

On the four months itself, I'd test the claim. Accelerators save time
on the parts that are well-understood and save nothing on the parts
that are contested — and the contested parts are usually where the
schedule actually goes. In my experience the realistic saving is
smaller than advertised, but it's not zero, and more importantly it's
front-loaded, which matters when the alternative is having nothing to
show for a quarter.

The argument I'd make to whoever's deciding is about what we're
optimising. If the constraint is engineering capacity, buy the
commodity layer and spend the team on the operating model, which is
where the leverage is. If the constraint is understanding — if this
platform has to be operated by a team that needs to grow into it —
then building the bottom layer has training value that's worth some of
the four months. Those are different companies and they should make
different decisions, and saying which one we are is the actual answer
the panel wants.

**Architecture**

```
  ┌────────────────────────────────────────────────────────────────┐
  │ LAYER 3 — PAVED PATHS: service templates, deployment shapes,    │
  │ data patterns                                                   │
  │   product-specific; no vendor can know these      → BUILD ◄─(1) │
  ├────────────────────────────────────────────────────────────────┤
  │ LAYER 2 — OPERATING MODEL: vending approval logic, exception    │
  │ process, IAM group model, label taxonomy, cost allocation rule  │
  │   encodes how OUR company works; vendor opinions here become    │
  │   permanent divergence from their upstream         → BUILD ◄─(2)│
  ├────────────────────────────────────────────────────────────────┤
  │ LAYER 1 — COMMODITY: bootstrap, hierarchy scaffolding, baseline │
  │ policy set, log sink wiring, Shared VPC plumbing                │
  │   every company builds the same thing              → BUY ◄─ (3) │
  └────────────────────────────────────────────────────────────────┘
                                │
                                ▼
  CONDITIONS ON THE BUY — all four, or it's not a head start  ◄── (4)
   ┌──────────────────────────────────────────────────────────────┐
   │ a. output is Terraform in OUR repo, readable and modifiable   │
   │ b. no runtime dependency on vendor tooling                    │
   │ c. EXIT TEST: demonstrate we can stop paying and keep running │
   │    — demonstrated, not asserted                     ◄── (5)   │
   │ d. named internal owner who understands the generated code    │
   │    BEFORE the engagement ends                       ◄── (6)   │
   └──────────────────────────────────────────────────────────────┘
                                │
                                ▼
  TEST THE FOUR MONTHS  ◄── (7)
   saves time on well-understood parts; saves nothing on contested
   parts — and the contested parts are where the schedule actually goes

  THE DECIDING QUESTION: what are we optimising?  ◄── (8)
   engineering capacity constrained  → buy L1, spend the team on L2
   team must grow into operating it  → build L1 for its training value
   These are different companies. Say which one we are.  ◄── (9)
```

**Every arrow explained:**

1. **Layer 3 is always build** — paved paths encode product knowledge
   no vendor has. Wrong alternative: accepting a vendor's generic
   service template and then customising it into something unrecognisable.
2. **Layer 2 is build, and it's where the real work is** — the
   operating model is company-specific, and adopting a vendor's means
   permanent divergence from an upstream they keep changing.
3. **Layer 1 is buy** — commodity, identical everywhere, and where the
   claimed time saving actually lives.
4. **Four conditions, all required** — any one missing converts a head
   start into a dependency.
5. **Exit test demonstrated, not asserted** — ask them to show the
   system running with their tooling removed. A vendor who can't
   demonstrate it has told you the answer.
6. **Named internal owner before the engagement ends** — the real
   failure mode isn't bad code, it's a platform nobody on staff can
   reason about at 3am.
7. **Test the four-month claim** — savings concentrate in the
   well-understood parts, and schedules overrun on the contested ones.
8. **The deciding question is what we're optimising** — capacity or
   comprehension. Both are legitimate.
9. **Name which company we are** — the actual answer, and the part a
   principal-level panel is listening for.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Overall | Buy the commodity layer, build the operating model | Buy the whole thing | The operating model is where our specificity and our leverage both live | When the company has no strong opinions yet and genuinely wants a default operating model to start from — then adopt theirs and diverge later |
| Output form | Terraform we own in our repo | Vendor-managed configuration | We can read, modify and keep running it without them | When the vendor is genuinely operating it as a managed service and we've decided not to staff a platform team at all |
| Exit | Demonstrated, before signing | Contractual exit clause | A clause describes an exit; a demonstration proves one exists | When the engagement is small and short enough that the exit cost is trivially bounded |
| Knowledge transfer | Named owner who understands the code pre-handover | Documentation and a handover session | Understanding is a person, not a document | When the generated layer is genuinely never modified again — rare, and usually wishful |
| Build-for-learning | Only when the team must grow into operating it | Always build, for understanding | Four months of rebuilding a commodity is expensive learning | When the team is new to the platform and the four months doubles as the training that makes them effective |

**What a weak answer sounds like**

- "It depends on the requirements." — at principal level the panel is
  asking for a decision and a defence; the hedge is the failure.
- "Never buy — we need to understand our own platform." — treats four
  months of commodity work as free and ignores what the team could
  have built instead.
- "Take it, it'll save us four months." — accepts the vendor's claim
  and their opinions without asking what the seam is or what the exit
  looks like.
- "We'd customise it heavily." — heavy customisation of an upstream
  you don't control is the worst of both options; you pay for it and
  you still maintain it.

**Common wrong turns**

- **Evaluating on feature checklists.** Every accelerator ticks every
  box; the differences are in the opinions and the exit. Recover by
  re-framing the evaluation around the three layers.
- **Not testing the exit.** The clause is in the contract and nobody
  has ever run it. Recover by making a demonstration a condition of
  signing, which also tells you a lot about the vendor.
- **Letting the accelerator define the hierarchy after you've already
  decided one.** You then carry a permanent divergence. Recover by
  treating the hierarchy as a fixed input to the engagement, not a
  deliverable of it.
- **No internal owner.** The engagement ends, the consultants leave,
  and the first incident is archaeology. Recover by naming the owner
  at the start and measuring their comprehension, not the vendor's
  deliverables.

**Follow-up probes the interviewer asks next**

1. **"The vendor says their model is best practice and ours is
   non-standard. What do you say?"** — I'd ask which specific
   decision and why, because sometimes they're right and it's worth
   changing. What I wouldn't accept is "best practice" as an argument
   without a mechanism behind it.
2. **"Leadership has already committed to the vendor. Now what?"** —
   then I'd spend my influence on the four conditions rather than on
   reopening the decision, because those are what determine whether
   the commitment is recoverable.
3. **"Who owns this in two years?"** — our platform team, entirely,
   with the vendor's contribution indistinguishable from ours in the
   repository. If in two years there's still a "vendor part" nobody
   touches, the engagement failed regardless of how it went.
4. **"Escalate: what's the worst outcome of this decision?"** — a
   platform we can't modify during an incident, operated by people who
   didn't build it, with a vendor relationship that has to be renewed
   to keep running. That's why the exit test and the named owner are
   conditions rather than preferences.
5. **"How would you validate the four-month claim before
   committing?"** — ask for a reference customer of comparable size
   and ask them specifically where the schedule went, not whether they
   were satisfied. The variance between claimed and actual is the
   number that matters.
6. **"Would your answer change if the platform team were twenty people
   instead of six?"** — yes. At twenty, the capacity constraint is
   weaker and the comprehension argument gets stronger, and I'd lean
   toward building the commodity layer for the ownership it creates.
   Naming that the answer is size-dependent is part of the answer.

**Cross-references**

- `D1-Q01` for the layer-one scope this decision is about; `D1-Q05`
  and `D1-Q06` for the layer-two operating model that stays in-house.
- `01-domains/DOMAIN-1-designing-planning.md` §1.1 — business-
  requirement translation and procurement framing behind the
  build-versus-buy axis.
- `D1-Q16` for the governance mechanism that would record this
  decision and its revisit trigger.
