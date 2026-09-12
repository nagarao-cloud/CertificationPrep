# Design Interviews — Platform Reliability and Operations

> Seventeen whiteboard questions on the *operations* axis: can you make
> the platform survivable and affordable at steady state, not just
> correct on day one? Written for Staff and Principal Cloud Architect
> interviews in the 2026 market, not for exam prep. Every "answer" here
> is what a candidate **says out loud** in the room — first person,
> sequenced, committing to a choice and naming the constraint that
> forced it.

**How to use this file:** answer each question out loud before reading
past the clarifying-questions block. Structure questions (`design-01`)
ask what the platform *is*; these ask what it costs to run on a
Tuesday. The tradeoff table's last column is the one panels actually
probe, and in an operations interview it is usually the one that
exposes whether you have run something in production or only designed
it. Cross-references point at `03-comparisons/` for the underlying
matrices — in particular `03-comparisons/05-ha-dr-strategies.md` owns
the HA/DR tier names and RTO/RPO mapping this file uses and does not
restate.

## Question index

| ID | Question | Band | Axis | Domain leaves |
|---|---|---|---|---|
| D6-Q01 | The golden path: `git push` to production on an internal developer platform | Staff | operations | 4.1, 2.3, 5.2 |
| D6-Q02 | CI/CD for 40 teams on one platform, and where standardization stops | Staff+ | operations | 4.1, 5.2, 4.3 |
| D6-Q03 | A multi-cluster GKE fleet with config and policy delivered as code | Staff | operations | 2.3, 5.2, 6.2 |
| D6-Q04 | Observability-as-code — SLOs, dashboards and alerts shipped with the service | Staff | operations | 6.1, 5.2 |
| D6-Q05 | SLOs and error budgets across teams that don't share a manager | Principal | operations | 6.1, 4.2, 4.3 |
| D6-Q06 | Progressive delivery — canary/blue-green with automated rollback signals | Staff | operations | 4.3, 6.2 |
| D6-Q07 | The DR program for 200 services across different RTO/RPO tiers | Staff+ | operations | 6.2, 4.1 |
| D6-Q08 | A game-day and chaos program, and what the architecture must expose | Staff+ | operations | 6.2, 4.1 |
| D6-Q09 | Capacity and autoscaling for a workload with a 40x diurnal swing | Staff | operations | 6.2, 2.3, 4.3 |
| D6-Q10 | On-call and alerting that reduces toil rather than relocating it | Staff+ | operations | 6.1, 4.3 |
| D6-Q11 | The cost-performance loop for Dataflow and batch compute | Staff | operations | 4.3, 6.2 |
| D6-Q12 | A platform-wide cost-efficiency program — CUDs, rightsizing, Recommender | Staff+ | operations | 4.3, 4.2 |
| D6-Q13 | Sustainability-aware placement — Carbon Footprint data and region choice | Staff | operations | 4.2, 1.3 |
| D6-Q14 | Release management at 300 deploys/day with one regulated service | Staff+ | operations | 4.3, 6.2, 5.1 |
| D6-Q15 | The platform team's own reliability — when the platform is the outage | Principal | operations | 6.1, 6.2, 4.1 |
| D6-Q16 | Deprecating a platform capability 40 teams depend on | Principal | operations | 4.2, 5.1 |
| D6-Q17 | Build vs buy: a commercial IDP/observability product, or GCP-native | Principal | operations | 1.1, 4.2, 5.1 |

---

### D6-Q01 — "A developer pushes to main. Walk me through everything that happens until that change is serving production traffic — and every place it can stop."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 4.1, 2.3, 5.2 |
| **Axis** | operations |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D1-Q05` |

**What the interviewer is actually testing**

Whether you can describe a pipeline as a sequence of *gates* rather
than a sequence of *tools*. Anyone can name Cloud Build and Cloud
Deploy. The signal is whether you know what each step is allowed to
stop, what it may roll back on its own, and what it must escalate to a
human — and whether the path is short enough that engineers use it
instead of building their own.

**Clarifying questions to ask before drawing anything**

- **Is the golden path mandatory or optional?** This is the single
  biggest determinant of the design. An optional path has to win on
  ergonomics, which means it must be faster than the alternative. A
  mandatory path can afford gates, but then every gate is a tax I'm
  forcing on forty teams and I have to justify each one.
- **How many runtimes am I actually supporting?** Two or three
  languages onto one container runtime is a paved road. Eleven
  languages across VMs, containers and functions is three paved roads
  wearing one name, and I'd rather say that out loud than pretend
  otherwise.
- **What is the current lead time from merge to production, and what
  is the change-failure rate?** Those two numbers tell me whether the
  problem is speed or safety. Optimising the wrong one makes the other
  worse, and teams notice immediately.
- **Who owns production — the team that wrote the service, or a
  separate operations group?** If a separate group deploys, the
  pipeline ends at a handoff and everything downstream of that handoff
  is theatre. That's an organizational answer, not a technical one.
- **Are there services with a regulatory sign-off requirement today?**
  If yes, the path must support a gated variant without forking the
  pipeline — that's `D6-Q14`, and I'd flag it now rather than discover
  it at the end.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Merge to production without a ticket | Stated | — | Every gate must be automated or explicitly justified as human |
| One container runtime as the default target | Assumed | "I'm assuming we can standardise on containers for new services — if we can't, this is several paths, not one" | Determines whether the artifact contract is an image or something looser |
| Environments are prod / nonprod / dev folders | Assumed | "I'll assume the landing zone's environment-above-team folder shape, so a team owns three folders" | Promotion targets map to folders, not to namespaces inside one project |
| Only reviewed, scanned images reach prod | Assumed | "I'd expect supply-chain enforcement at deploy time, not just a CI scan step" | Adds Binary Authorization attestation to the artifact contract |
| Rollback must not require the author | Stated | — | Rollback becomes a signal-driven action, not a human decision |
| Every service emits its SLO from day one | Assumed | "Otherwise the path ships services nobody can tell are broken" | Observability is a pipeline artifact, not a follow-up ticket |

**The answer, out loud**

I'd describe this as one path with eight stops, and I'd be explicit
that only two of them may involve a human, because every human stop is
where lead time actually goes.

It starts with a contract, not with a tool. A repository that wants to
use the golden path declares a small manifest at its root: the service
name, its owning team, its data class, its SLO target, and its
dependencies. That manifest is what makes everything downstream
possible without bespoke configuration per service — the pipeline
reads it to decide which Shared VPC to attach to, which Cloud Deploy
targets exist, what labels to stamp, and what alerts to provision. If
a repo has no manifest, it isn't on the path, and that's a clean
binary rather than a spectrum of half-onboarded services.

Push to a branch triggers the pre-merge build in `prj-common-cicd`:
compile, unit tests, and a container build that is thrown away. The
only thing pre-merge produces is a verdict. I keep it cheap on purpose
because this runs on every push and it's the step engineers feel most.

Merge to main triggers the real build, and this is where the artifact
contract is created. Cloud Build produces exactly one image, pushes it
to `prj-common-registry`, and the image digest becomes the identity of
this change for the rest of its life. Everything downstream references
the digest, never a tag, because a mutable tag means the thing you
tested and the thing you deployed can silently differ. Vulnerability
scanning runs here, and a passing scan produces a Binary Authorization
attestation. A critical finding stops the pipeline at this step —
that's automated gate one.

The image then deploys itself to dev automatically, with no approval,
and runs integration tests against real dependencies. I want dev to be
a real deployment target rather than a local container compose file,
because the first time a service meets the Shared VPC, Workload
Identity and the real database driver should not be in staging.

Promotion to staging is automatic on a green dev run. Promotion to
production is the first place I'd accept a gate, and I'd make it a
*policy* gate rather than a person: Cloud Deploy will not promote if
the service's error budget for the current window is already
exhausted, if the staging bake time hasn't elapsed, or if the image
lacks its attestation. Those three conditions cover most of what a
human approver was actually checking, and unlike a human they don't
take four hours to notice the request.

Production rollout is progressive — a canary slice, automated analysis
against the service's own SLIs, then a widening rollout. That's
`D6-Q06` in detail and I'd gesture at it rather than draw it twice.
The part that belongs here is that rollback is triggered by the
rollout's own analysis, not by a page. If the canary's error rate or
latency crosses the threshold declared in the manifest, Cloud Deploy
rolls back to the previous release and *then* notifies. Waking someone
up to press a button they will press every time is toil.

The last stop is the one people forget: the pipeline registers the
deployment as an annotation on the service's monitoring dashboards and
records the digest, the commit, and the deploying identity in the
audit trail. That's what makes "what changed at 14:05" a query instead
of an investigation, and it costs almost nothing to emit at deploy
time.

What I'd flag unprompted is what I'd deliberately leave off the path
on day one: no manual performance-test gate, no change-advisory
review, and no per-service pipeline customisation. All three are
requests I'd expect within the first quarter, and all three are how a
golden path turns into forty bespoke pipelines with a shared logo.

**Architecture**

```
  STEP 1 — CONTRACT                      repo root: service manifest
  ┌────────────────────────────────────────────────────────┐
  │ name · team · data-class · slo-target · dependencies   │ ◄── (1)
  │ no manifest → not on the path (clean binary)           │
  └───────────────────────────┬────────────────────────────┘
                              │ git push (branch)
                              ▼
  STEP 2 — PRE-MERGE      Cloud Build @ prj-common-cicd
  ┌────────────────────────────────────────────────────────┐
  │ compile · unit tests · throwaway image build           │ ◄── (2)
  │ STOPS ON: test failure          ROLLS BACK: nothing    │
  └───────────────────────────┬────────────────────────────┘
                              │ merge to main
                              ▼
  STEP 3 — BUILD          Cloud Build → Artifact Registry
  ┌────────────────────────────────────────────────────────┐
  │ one image · pushed to prj-common-registry · DIGEST is  │ ◄── (3)
  │ the identity from here on — never a mutable tag        │
  └───────────────────────────┬────────────────────────────┘
                              ▼
  STEP 4 — SUPPLY-CHAIN GATE            scan + attest
  ┌────────────────────────────────────────────────────────┐
  │ vulnerability scan → Binary Authorization attestation  │ ◄── (4)
  │ STOPS ON: critical finding       AUTOMATED GATE 1      │
  └───────────────────────────┬────────────────────────────┘
                              ▼
  STEP 5 — DEV            Cloud Deploy target: fldr-dev-<team>
  ┌────────────────────────────────────────────────────────┐
  │ auto-deploy · integration tests against real deps      │ ◄── (5)
  │ STOPS ON: integration failure    ROLLS BACK: n/a (dev) │
  └───────────────────────────┬────────────────────────────┘
                              ▼
  STEP 6 — STAGING        Cloud Deploy target: fldr-nonprod-<team>
  ┌────────────────────────────────────────────────────────┐
  │ auto-promote on green · bake time starts               │ ◄── (6)
  └───────────────────────────┬────────────────────────────┘
                              ▼
  STEP 7 — PROMOTION POLICY GATE        not a person
  ┌────────────────────────────────────────────────────────┐
  │ error budget remaining? · bake elapsed? · attested?    │ ◄── (7)
  │ STOPS ON: any of the three       AUTOMATED GATE 2      │
  └───────────────────────────┬────────────────────────────┘
                              ▼
  STEP 8 — PROD           Cloud Deploy target: fldr-prod-<team>
  ┌────────────────────────────────────────────────────────┐
  │ canary slice → automated SLI analysis → widen          │ ◄── (8)
  │ ROLLS BACK AUTOMATICALLY on SLI breach, then notifies  │
  └───────────────────────────┬────────────────────────────┘
                              ▼
  STEP 9 — RECORD         deploy annotation + audit entry  ◄── (9)

  Cross-cutting: the pipeline runs in prj-common-cicd with Workload
  Identity Federation to the SCM, never a long-lived key (10); one
  pipeline definition serves every service, parameterised by the
  manifest, never forked per team (11).
```

**Every arrow explained:**

1. **Service manifest as the contract** — one declarative file makes
   every downstream step generic. The common wrong alternative is a
   per-service pipeline file, which means forty pipelines to patch the
   day a gate changes.
2. **Cheap pre-merge step** — verdict only, no artifact retained. Keep
   it fast; this step decides whether engineers feel the platform as
   help or as friction.
3. **Digest, not tag, as identity** — the artifact is immutable and
   addressable. Wrong alternative: promoting a floating tag between
   environments, which makes "what's in prod" unanswerable during an
   incident.
4. **Scan then attest** — the attestation is what Binary Authorization
   checks at deploy time, so the CI result is enforced at the runtime
   boundary rather than trusted.
5. **Dev as a real deployment target** — first contact with Shared
   VPC, Workload Identity and the real data layer happens here, not in
   staging under time pressure.
6. **Staging bake** — elapsed time in staging is a gate input, because
   some failure classes only appear after a few thousand requests.
7. **Policy gate, not an approver** — error budget, bake, attestation.
   This replaces most of what a human approval was checking, and it
   replaces it with something that responds in seconds.
8. **Progressive prod rollout with automatic rollback** — the rollout
   watches the service's own SLIs and reverts itself. Notification
   follows the rollback; it does not precede it.
9. **Deploy annotation and audit record** — cheap to emit, and the
   difference between a correlation query and an archaeology project
   when something breaks an hour later.
10. **Workload Identity Federation to the SCM** — the pipeline holds
    no long-lived credential. See `D1-Q05` for the vending-side view
    of the same identity model.
11. **One pipeline definition, parameterised** — forking per team is
    how the path stops being golden; `D6-Q02` is exactly where
    parameterisation must be allowed to stop.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Path enforcement | Mandatory for new services, opt-in migration for existing | Optional everywhere | A path everyone can ignore gets ignored by exactly the teams you needed on it | When the platform team has no mandate and must earn adoption — then ergonomics is the only lever and mandatory language destroys goodwill |
| Artifact identity | Immutable digest | Tag promoted between environments | "What is running in prod" stays answerable under pressure | When the deployment target genuinely can't reference digests — rare, and worth fixing rather than accommodating |
| Production gate | Policy (budget, bake, attestation) | Named human approver | Responds in seconds and checks the same things a human was checking | When a regulator requires a named accountable person per release — then a human gate, scoped to that service only (`D6-Q14`) |
| Rollback trigger | Automated on SLI breach | Page a human who decides | The human decision is the same every time; automating it removes hours of MTTR | When rollback itself is risky — a schema migration that can't reverse — then the human gate is the safety, and the fix is making migrations reversible |
| Pipeline shape | One definition, manifest-parameterised | Per-team pipelines from a template | A gate change ships once instead of forty times | When teams have genuinely different build semantics (a monorepo with a bespoke build system) — then a second path, named and owned, not a fork |

**Making it concrete**

```hcl
# One delivery pipeline definition; targets map to the three folders a
# team owns, because environment sits above team in the hierarchy.
resource "google_clouddeploy_delivery_pipeline" "service" {
  name     = "SERVICE_NAME"
  project  = "prj-common-cicd"
  location = "REGION"
  serial_pipeline {
    stages { target_id = "dev" }
    stages { target_id = "staging" }
    stages {
      target_id = "prod"
      strategy { canary { runtime_config { kubernetes { gateway_service_mesh {} } } } }
    }
  }
}
```

The pipeline lives in the shared CI/CD project while its targets point
into three different team folders. That split is the whole reason the
promotion path is auditable: one identity promotes, three environments
receive, and no team can deploy to production by any route that
doesn't pass through here.

**What a weak answer sounds like**

- "Cloud Build builds it, Cloud Deploy deploys it." — a tool list, not
  a path. The follow-up is always "what stops it," and there's nowhere
  to go.
- "Then the release manager approves the deploy." — describes the
  bottleneck rather than the design; the panel wants to know what the
  approver is actually checking and why a policy can't check it.
- "Each team owns their own pipeline, we just provide examples." — an
  example repository is not a platform, and it guarantees that a
  security gate added next year lands in four of forty pipelines.
- "We'd roll back manually if something goes wrong." — manual rollback
  is the single largest controllable component of MTTR, and saying it
  casually tells the panel you haven't measured yours.

**Common wrong turns**

- **Designing the pipeline before the artifact contract.** People draw
  build steps first and discover later that nothing downstream can
  address the artifact uniquely. Recover by declaring the digest as
  identity out loud and rebuilding the rest around it.
- **Putting a human at the staging gate.** It feels safe and it moves
  all the lead time to the least valuable place. Recover by asking
  what the human is checking and converting each item into a policy
  condition.
- **Letting the path grow per-service options.** Every option is
  reasonable and the tenth one makes the path unmaintainable. Recover
  by pushing variation into the manifest's declared values, never into
  the pipeline's structure.
- **Forgetting the deploy annotation.** Cheap at build time,
  impossible to reconstruct at 3am. Recover immediately — it's one
  step and it changes every future incident.

**Follow-up probes the interviewer asks next**

1. **"A team says the path is too slow and they want to deploy
   directly. What do you do?"** — I'd measure their claim first,
   because it's often true. If the slowness is the scan step, I'd
   parallelise it; if it's the bake time, I'd defend it. What I
   wouldn't do is grant a bypass, because the first bypass is the end
   of the path as a control surface.
2. **"Escalate this: the pipeline pushes a bad image to all 40 teams'
   services at once. How?"** — through a shared base image or a shared
   pipeline step, which is the real blast radius of standardisation.
   I'd version base images, pin them per service in the manifest, and
   roll base-image changes out progressively like any other release,
   because a platform change is a production change.
3. **"How do you onboard a service that already exists and doesn't
   fit?"** — manifest first, path second. I'd get it emitting the
   manifest and the SLO before I touch its build, because that gives
   me the observability to tell whether my migration broke it.
4. **"Who owns this in two years?"** — a platform team with a product
   manager and a published roadmap. If the pipeline has no owner, the
   last urgent exception becomes its design, and the path decays into
   a suggestion.
5. **"What's the first metric you'd put on this?"** — lead time from
   merge to production at the median and the ninetieth percentile. The
   median tells me if the path works; the tail tells me where the
   human gates are hiding.
6. **"What breaks first at ten times the deploy volume?"** — not the
   build, which scales; the bake windows and the canary analysis,
   which serialise per service. At that volume I'd want per-service
   parallel pipelines and shorter, statistically-justified bake times
   rather than fixed ones (`D6-Q14`).

**Cross-references**

- `02-services/07-devops-cicd.md` — Cloud Build versus Cloud Deploy
  responsibilities and Binary Authorization's deploy-time enforcement;
  don't re-derive them.
- `D1-Q05` for project vending, which is what makes the Cloud Deploy
  targets exist in the first place.
- `D6-Q04` for the observability the manifest provisions; `D6-Q06` for
  the progressive rollout step 8 compresses.

---

### D6-Q02 — "Forty teams, one CI/CD platform. What do you standardize, and where exactly does standardization stop?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 4.1, 5.2, 4.3 |
| **Axis** | operations |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D6-Q01` |

**What the interviewer is actually testing**

Whether you can draw a line and defend both sides of it. Junior
answers standardize everything; tired answers standardize nothing and
call it autonomy. The signal is whether you have a *principle* for
where the line sits, and whether you can name what you give up on each
side of it.

**Clarifying questions to ask before drawing anything**

- **What's the actual pain that made this a question?** Forty
  divergent pipelines is a symptom. If the pain is "a security patch
  took six weeks to land everywhere," I standardize the gate layer. If
  it's "onboarding a new service takes two weeks," I standardize the
  scaffolding. Different pains, different lines.
- **Are the forty teams building similar things?** Forty variations of
  a containerised HTTP service is one path. That plus data pipelines
  plus mobile clients plus a monorepo is three or four paths, and
  pretending it's one is how the platform gets a reputation for not
  fitting anyone.
- **How many people are on the platform team?** This sets how many
  paved paths I can genuinely own. I'd rather own two excellently than
  five badly, and I'd say that number out loud.
- **Does anyone currently have a legitimate exception, and why?** The
  existing exceptions are the design input. If three teams bypassed
  the platform for the same reason, that reason is a gap in my design,
  not a discipline problem.
- **Is there a compliance obligation that must be true of every
  build?** That's the non-negotiable floor and it goes below the line
  regardless of what else I decide.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Security gates must be universal | Assumed | "I'll assume a scan-and-attest gate has to be true of everything that reaches prod" | Defines the mandatory floor |
| Teams keep ownership of their tests | Assumed | "I'm assuming test strategy stays with the team — I'd push back hard on centralising it" | Test content is above the line, test *execution* is below |
| Build minutes are centrally funded | Assumed | "If teams pay their own build costs, the incentives change and so does the design" | Determines whether efficiency is a platform or team concern |
| One artifact store for everything | Stated | — | Registry is a floor concern, not a choice |
| At least one team has a genuinely different build | Assumed | "There's always one — usually a monorepo or a mobile build" | Forces a named second path rather than an exception |

**The answer, out loud**

My principle is that the platform standardizes the *interfaces* and
the *gates*, and teams own the *content*. Everything below that line
is mandatory and invisible; everything above it is theirs and I don't
have an opinion. If I can state which side of the line something falls
on and why, the design is defensible. If I'm arguing case by case, I
don't have a line, I have a queue.

Below the line, mandatory, four things. First, where builds run: one
Cloud Build environment in `prj-common-cicd`, with private pools for
anything needing to reach internal resources, and Workload Identity
Federation to the source-control system rather than keys. I don't
negotiate on this because it's the identity boundary — a team running
its own builders with its own credentials is a parallel trust domain
nobody is reviewing.

Second, where artifacts land: `prj-common-registry`, digest-addressed,
scanned, attested. Third, how promotion happens: Cloud Deploy
pipelines whose targets are the team's three environment folders, so
the only route into production is one I can audit. Fourth, the
mandatory label set and the deploy record — the metadata that makes
cost attribution and incident correlation possible, which means
`D1-Q08`'s billing structure depends on my pipeline stamping labels.

Above the line, theirs. What language and framework. What their tests
assert and how many there are. Their branching model. Their release
cadence. Whether they deploy ten times a day or once a sprint. How
they structure their repository. I deliberately have no opinion on
these, and I'd say so explicitly, because the fastest way to make
forty teams route around a platform is to have opinions about their
source tree.

The interesting part is the middle, and I'd spend most of my time
there. Some things look like content but behave like interfaces. Base
images are the clearest example: a team choosing its own base image
looks like autonomy, but it means a critical vulnerability fix has to
land in forty repositories. So I'd provide a small set of maintained
base images, make them the default, and allow a team to opt out with a
declared reason in the manifest — which turns an invisible divergence
into a visible, reviewable one. Same treatment for the test *runner*
(standardized, because it's how results get reported) versus the tests
themselves (theirs).

The mechanism I'd use for the whole middle band is defaults with
declared exceptions rather than permission. A team can set a different
base image, a longer bake time, or a different canary shape by
declaring it in their manifest. The declaration is the control: it's
in code review, it shows up in a report of every service that differs
from default, and it gives me a list of the divergences that are
actually load-bearing. Permission-based exception handling puts the
platform team in the approval path for things that mostly should be
allowed, and that's how a six-person team becomes a ticket queue.

Where I'd stop standardizing entirely is anything where being the same
has no compounding benefit. Everyone using the same log format
compounds — it makes one query work everywhere. Everyone using the
same code formatter does not compound across teams; it's a team-local
preference and forcing it buys me nothing but resentment. I'd use that
test explicitly: does uniformity here produce leverage, or just
uniformity?

And I'd name the second path honestly. There's always a workload that
doesn't fit — a monorepo, a mobile pipeline, a data platform with its
own orchestration. I'd rather define a second supported path with a
named owner than let it live as a permanent exception, because an
exception has no maintainer and a path does.

**Architecture**

```
                    THE LINE — interfaces and gates below,
                    content above. State it once, apply it
                    to every new request.            ◄── (1)

  ABOVE THE LINE — team owns, platform has no opinion
  ┌──────────────────────────────────────────────────────────┐
  │ language · framework · test content · branching model    │ ◄── (2)
  │ release cadence · repo layout · code style               │
  └──────────────────────────────────────────────────────────┘
  ═══════════════════ THE MIDDLE BAND ═══════════════════════
  ┌──────────────────────────────────────────────────────────┐
  │ DEFAULT + DECLARED EXCEPTION (not permission)    ◄── (3) │
  │  base images  ·  bake time  ·  canary shape  ·  runners  │
  │  declaration lives in the service manifest → visible,    │
  │  reviewable, reportable                          ◄── (4) │
  └──────────────────────────────────────────────────────────┘
  ═══════════════════════════════════════════════════════════
  BELOW THE LINE — mandatory, invisible, non-negotiable
  ┌──────────────────────────────────────────────────────────┐
  │ (a) WHERE BUILDS RUN   prj-common-cicd, WIF, no keys ◄(5)│
  │ (b) WHERE ARTIFACTS GO prj-common-registry, digest,      │
  │     scanned + attested                           ◄── (6) │
  │ (c) HOW PROMOTION WORKS Cloud Deploy → 3 env folders ◄(7)│
  │ (d) METADATA            labels + deploy record   ◄── (8) │
  └──────────────────────────────────────────────────────────┘

  SECOND PATH (named, owned, not an exception)        ◄── (9)
   monorepo / mobile / data-orchestration builds get their own
   supported path with the SAME four floor items, different
   ergonomics above them.

  Cross-cutting: the test for anything ambiguous is "does uniformity
  here compound into leverage, or is it just uniformity?" (10)
```

**Every arrow explained:**

1. **One stated line** — interfaces and gates below, content above.
   Having the principle is what lets you answer the fortieth request
   without renegotiating from scratch.
2. **Above the line is genuinely hands-off** — and saying so out loud
   is what buys credibility for the mandatory floor. A platform with
   opinions about branching models will not be trusted with the parts
   that matter.
3. **Defaults with declared exceptions** — not approval. The wrong
   alternative is an exception request queue, which makes the platform
   team the bottleneck for things that should mostly be allowed.
4. **The declaration is the control** — a report of every service
   diverging from default is far more useful than a policy nobody can
   measure compliance with.
5. **One build environment, federated identity** — a team running its
   own builders is an unreviewed trust domain. This is the item I'd
   least negotiate.
6. **One registry, digest-addressed, attested** — makes Binary
   Authorization enforceable at the runtime boundary and makes "what's
   deployed" a single query.
7. **Promotion only through Cloud Deploy into the three environment
   folders** — the only auditable route to production. Wrong
   alternative: allowing direct deploys "for emergencies," which
   becomes the normal path within a quarter.
8. **Mandatory labels and deploy records** — `D1-Q08`'s cost
   attribution depends entirely on the pipeline stamping these, which
   makes metadata a CI/CD concern and not a finance one.
9. **A named second path instead of a permanent exception** — an
   exception has no maintainer; a path has an owner and a roadmap.
10. **The compounding test** — the tiebreaker for every ambiguous
    case, applied out loud so teams can predict the answer.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Standardization scope | Interfaces and gates only | Full pipeline standardization including test strategy | Teams accept a floor they can't see; they fight a ceiling they can | When the org has a genuine uniform-compliance mandate across every service — then standardize more and staff the platform team to carry it |
| Exception mechanism | Declared in the manifest | Approval request to the platform team | Keeps a six-person team out of the critical path of forty teams | When the exception is genuinely risky (a build reaching production data) — then approval, for that class only |
| Base images | Maintained defaults, opt-out declared | Teams choose freely | A vulnerability fix lands once instead of forty times | When a team's runtime genuinely isn't covered by the maintained set — then their opt-out is correct and should be permanent |
| Number of paved paths | Two, named and owned | One path plus permanent exceptions | An exception has no maintainer and rots; a second path has an owner | When the platform team is too small to own two — then one path, and say plainly that the misfit workloads are unsupported |
| Build cost model | Centrally funded | Charged back to teams | Removes the incentive to build a cheaper shadow pipeline | When build spend is large enough to distort platform economics — then showback first, chargeback only if behaviour doesn't change (`D1-Q09`) |

**What a weak answer sounds like**

- "We'd standardize everything — consistency is the point." — the
  panel will ask about the monorepo team, and "they'd have to adapt"
  is how platforms lose their mandate.
- "Teams are autonomous, we just offer tools." — then there is no
  floor, and the answer to "how fast can you patch every build" is
  "we can't."
- "We'd review each exception case by case." — describes a queue, not
  a principle; the fortieth case takes as long as the first.
- "Everyone uses the same base image, full stop." — right instinct,
  wrong mechanism; without a declared opt-out, the team that can't
  comply forks silently and you lose the visibility you were after.

**Common wrong turns**

- **Standardizing the visible things and missing the invisible ones.**
  Code style gets a policy; base images don't. Recover by asking which
  divergences cost you during an incident, not which ones you can see
  in a pull request.
- **Treating the second path as failure.** It reads as a compromise
  and it's actually maturity. Recover by naming and staffing it rather
  than letting it exist as an exception nobody owns.
- **Putting the platform team in the approval path.** Every request is
  small and there are forty teams. Recover by converting approvals
  into declarations plus a divergence report.
- **Changing the line without announcing it.** Teams plan against the
  line; moving it quietly destroys the trust that makes the floor
  enforceable. Recover by treating line changes as a deprecation
  (`D6-Q16`), with notice and a migration window.

**Follow-up probes the interviewer asks next**

1. **"A principal engineer on a product team says your floor slows
   them down. How does that conversation go?"** — I'd ask which
   specific item and what it costs them in minutes, because usually
   it's one thing and it's fixable. If they're right, I change the
   floor for everyone rather than granting them a bypass.
2. **"How do you patch a vulnerability in a base image across forty
   teams?"** — publish the new base image version, open automated pull
   requests against every manifest pinning the old one, and track the
   burndown publicly. The teams that opted out get a direct
   conversation, and the opt-out list is exactly the work queue.
3. **"Escalate: what's the blast radius if your shared pipeline step
   is wrong?"** — every service that builds after the change, which is
   the whole estate within a day. So platform changes get the same
   progressive rollout as product changes: a canary cohort of teams
   first, then widen. Treating platform changes as exempt from
   progressive delivery is the mistake this probe is hunting for.
4. **"Who decides where the line sits in two years?"** — the platform
   team proposes, an architecture forum with product representation
   ratifies. If the platform team decides alone, the line drifts
   toward its own convenience and teams stop consenting to it
   (`D1-Q16`).
5. **"What would you standardize last?"** — anything that only matters
   inside one team's repository. Uniformity there buys nothing and
   costs goodwill I'll need for the floor.
6. **"How do you know standardization is working?"** — time to land a
   mandatory change across the estate, and the count of services
   diverging from default. Both are trends; either one flat or rising
   means the floor is eroding.

**Cross-references**

- `D6-Q01` for the path this question draws the boundary around;
  `D6-Q16` for how to move the line once teams depend on it.
- `D1-Q06` — the enforced/detected/advisory guardrail taxonomy is the
  security analogue of this line; the mechanism is the same.
- `02-services/07-devops-cicd.md` — Cloud Build private pools and
  Artifact Registry configuration behind floor items (a) and (b).

---

### D6-Q03 — "You've got a dozen GKE clusters across regions and teams. How does configuration and policy get to all of them without anyone running kubectl?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 2.3, 5.2, 6.2 |
| **Axis** | operations |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D6-Q02` |

**What the interviewer is actually testing**

Whether you understand the difference between deploying an application
to a cluster and managing the cluster estate itself — two different
lifecycles, two different owners, two different failure modes. The
weak answer merges them. The strong answer explains why merging them
means a policy change and a product release share a blast radius.

**Clarifying questions to ask before drawing anything**

- **Why a dozen clusters rather than fewer?** If it's regional
  latency, the count is a consequence and I design for it. If it's
  "each team wanted their own," I'd ask whether namespace-level
  isolation with quotas would have served, because cluster count is
  the dominant cost in this design.
- **Is anything running outside Google Cloud that has to obey the same
  policy?** That's the GKE Enterprise fleet question, and it changes
  whether config delivery needs to reach non-GCP clusters.
- **Who is allowed to change cluster configuration today?** If the
  honest answer is "anyone with cluster-admin," then step one is
  removing that, and everything else I design is decoration until it's
  done.
- **What's the current drift situation?** If three clusters have
  hand-applied changes nobody can account for, reconciliation will
  revert them and that's an outage waiting to happen. I'd want a drift
  audit before enabling enforcement.
- **How do teams currently get a namespace?** That answer tells me
  whether cluster onboarding is already automated or whether I'm also
  building that.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| No human runs kubectl against prod | Stated | — | Everything reaches a cluster through reconciliation, not a session |
| Cluster config and app config have different owners | Assumed | "I'll assume the platform owns cluster-level config and teams own their workloads" | Two repositories, two pipelines, two blast radii |
| Policy must be provably applied everywhere | Assumed | "I'd expect an auditor to ask for evidence, not a screenshot" | Reconciliation status becomes the compliance artifact |
| Some clusters are regulated, most aren't | Assumed | "Otherwise every cluster carries the strictest policy set" | Fleet needs scopes, not one global config |
| New cluster must be compliant at creation | Assumed | "A cluster that's compliant only after someone remembers isn't compliant" | Bootstrap config is part of provisioning, not a follow-up |

**The answer, out loud**

I'd separate this into three delivery planes, and the reason is blast
radius: a cluster-level policy change and an application release
should never be able to break each other.

Plane one is cluster existence and shape — how many clusters, in which
regions, with what node pools, what version channel, what network
config. That's Terraform, run from `prj-common-cicd`, with state in
the bootstrap project. It changes rarely and each change is reviewed
like infrastructure, because creating or resizing a cluster is a
capacity and cost event, not a config tweak.

Plane two is cluster-level configuration and policy — namespaces,
quotas, network policies, admission constraints, the baseline RBAC,
and the logging and monitoring agents' configuration. This is
delivered by config management against the fleet, reading from a
platform-owned Git repository, continuously reconciled. Continuous
reconciliation is the point, not a one-time apply: if somebody does
manage to change something on a cluster directly, it gets reverted
within minutes, and the revert is the evidence that the control works.
I'd also enable policy enforcement in audit mode first and only then
in enforcing mode, because the difference between "nothing violates
this" and "nothing violates this yet" is a production incident.

Plane three is workloads — the team's own Deployments, Services and
configuration, delivered by Cloud Deploy from the golden path in
`D6-Q01`. Teams own this plane entirely and don't have write access to
plane two. That separation is what lets a platform policy change roll
out on a Tuesday without coordinating with forty release schedules.

The organising abstraction across all three is the fleet. I'd register
every cluster into one fleet and use scopes to express the differences
rather than maintaining separate config per cluster. Most clusters get
the baseline scope. The regulated ones get the baseline plus a
stricter overlay — additional admission constraints, tighter egress
policy, a different logging destination. Expressing this as scopes
rather than per-cluster directories matters because the moment config
is per-cluster, the twelfth cluster diverges and nobody notices until
an audit.

There's one more piece people leave out and I'd raise unprompted: GCP
resources a workload needs that aren't Kubernetes objects — a Pub/Sub
topic, a Cloud Storage bucket, a service account binding. Config
Connector lets those be declared as Kubernetes resources in the same
repository and reconciled the same way, which means a team's namespace
and its cloud dependencies have one source of truth. I'd use it
selectively: for resources whose lifecycle genuinely belongs to the
workload. I would not use it for shared infrastructure — the Shared
VPC, the org policy, the key ring — because those belong to Terraform,
and two systems that both believe they own a resource is a
reconciliation fight that ends badly.

Rollout of a plane-two change is itself a progressive delivery
problem. I'd push a config change to a canary scope of one non-prod
cluster, let reconciliation complete, verify the fleet's sync status,
then widen. A policy change applied to twelve clusters simultaneously
is the platform equivalent of deploying to production without a canary
— and it's the failure mode that convinces an org that config-as-code
is dangerous, when what was dangerous was the rollout.

**Architecture**

```
  PLANE 1 — CLUSTER EXISTENCE (Terraform, rare, reviewed as infra)
  ┌────────────────────────────────────────────────────────────┐
  │ clusters · node pools · release channel · VPC attachment   │◄─(1)
  │ state in prj-bootstrap-seed · applied from prj-common-cicd │
  └───────────────────────────┬────────────────────────────────┘
                              │ registers each cluster into
                              ▼
  ┌────────────────────────────────────────────────────────────┐
  │                      FLEET                           ◄─(2) │
  │   scope: baseline        scope: regulated-overlay          │
  │   (10 clusters)          (2 clusters, baseline + stricter) │
  └───────────────────────────┬────────────────────────────────┘
                              │
  PLANE 2 — CLUSTER CONFIG + POLICY (platform-owned Git, continuous)
  ┌───────────────────────────▼────────────────────────────────┐
  │ namespaces · quotas · network policy · admission           │◄─(3)
  │ constraints · baseline RBAC · agent config                 │
  │ CONTINUOUS RECONCILIATION — manual change reverted, and    │
  │ the revert IS the audit evidence                     ◄─(4) │
  │ rollout: audit mode → canary scope → widen           ◄─(5) │
  └───────────────────────────┬────────────────────────────────┘
                              │  teams have NO write access here (6)
  PLANE 3 — WORKLOADS (team-owned, Cloud Deploy, golden path)
  ┌───────────────────────────▼────────────────────────────────┐
  │ Deployments · Services · team config · per-release         │◄─(7)
  └────────────────────────────────────────────────────────────┘

  SIDECAR CONCERN — cloud resources a workload owns
  ┌────────────────────────────────────────────────────────────┐
  │ Config Connector: Pub/Sub topic, bucket, SA binding  ◄─(8) │
  │ NOT: Shared VPC, org policy, key rings → Terraform    ◄─(9)│
  └────────────────────────────────────────────────────────────┘

  Cross-cutting: fleet sync status per cluster is a monitored signal,
  and a cluster out of sync beyond a threshold pages the platform team
  — an unsynced cluster is an ungoverned cluster (10).
```

**Every arrow explained:**

1. **Terraform owns cluster existence** — creating or resizing a
   cluster is a cost and capacity event. Wrong alternative: creating
   clusters from the same continuously-reconciled repo as policy,
   which makes a bad merge able to delete a cluster.
2. **One fleet, scopes for difference** — the abstraction that stops
   per-cluster directories from appearing. Per-cluster config is how
   the twelfth cluster silently diverges.
3. **Platform-owned config repository** — cluster-level objects only.
   The separation from plane three is what decouples policy changes
   from release schedules.
4. **Continuous reconciliation, not one-time apply** — drift is
   reverted automatically and the reconciliation record is the
   compliance artifact an auditor can actually be shown.
5. **Audit mode before enforcing mode, canary scope before fleet** — a
   policy change is a production change and gets the same rollout
   discipline as one (`D6-Q06`).
6. **Teams have no write access to plane two** — the boundary that
   makes the whole model work. Wrong alternative: giving team leads
   cluster-admin "for emergencies," which returns you to unmanaged
   clusters within a quarter.
7. **Workloads through the golden path** — same artifact contract and
   promotion gates as `D6-Q01`, targeting namespaces rather than
   clusters.
8. **Config Connector for workload-owned cloud resources** — one
   source of truth for a namespace and its dependencies.
9. **Terraform, not Config Connector, for shared infrastructure** —
   two systems believing they own the Shared VPC is a reconciliation
   fight with production consequences.
10. **Sync status as a monitored signal** — an out-of-sync cluster is
    ungoverned, and that deserves a page, not a dashboard nobody
    checks.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Config delivery | Continuous reconciliation from Git | Pipeline that applies manifests on merge | Drift is reverted, not just detected, and the record is audit evidence | When the cluster hosts workloads that legitimately mutate their own config at runtime — then reconciliation fights the workload and a pipeline apply is safer |
| Fleet modelling | One fleet with scopes | Per-cluster configuration directories | Difference is expressed once; new clusters inherit rather than get authored | When two clusters genuinely share nothing — a separate business unit with its own regulator — then a second fleet, not a scope |
| Cluster lifecycle | Terraform, separate from config | Everything in the reconciled repository | A bad merge can't delete a cluster | When cluster count is very high and churns constantly — then cluster provisioning as reconciled config is worth its risk, with strict review |
| Cloud resources for workloads | Config Connector, scoped to workload-owned resources | Terraform for everything | One source of truth per namespace; teams don't wait on a platform merge | When the team has no Kubernetes fluency at all — then Terraform modules with a simple interface beat teaching a second object model |
| Policy rollout | Audit mode, canary scope, then widen | Enforce fleet-wide immediately | Finds the violations you didn't know about without taking prod down | When the policy closes an actively-exploited security gap — then enforce immediately and accept the breakage, deliberately |

**Making it concrete**

```hcl
# A cluster joins the fleet at creation; policy arrives by scope, not
# by a per-cluster config directory somebody has to remember to write.
resource "google_gke_hub_membership" "cluster" {
  membership_id = "CLUSTER_NAME"
  project       = "PROJECT_ID"
  endpoint {
    gke_cluster { resource_link = "//container.googleapis.com/CLUSTER_SELF_LINK" }
  }
}

resource "google_gke_hub_scope" "regulated" {
  scope_id = "regulated-overlay"
  project  = "PROJECT_ID"
}
```

Membership is created by the same Terraform run that creates the
cluster, which is what makes "compliant at creation" true rather than
aspirational — there is no window in which a cluster exists and is not
yet governed.

**What a weak answer sounds like**

- "We'd use a config repo and apply it with the pipeline." — apply is
  not reconcile; the day someone changes something by hand, an
  apply-based model never notices.
- "Each cluster has its own config directory." — honest, workable at
  three clusters, and the reason the twelfth one is different in a way
  nobody can explain.
- "Teams need cluster-admin for emergencies." — the emergency is
  exactly when unreviewed changes are most dangerous, and the
  break-glass path (`D1-Q07`) exists so this isn't necessary.
- "We'd put everything in Config Connector, including the VPC." — two
  owners for one resource; the panel will ask what happens when
  Terraform and the reconciler disagree, and there's no good answer.

**Common wrong turns**

- **Enabling enforcement before auditing drift.** Reconciliation
  reverts the undocumented change that was holding production
  together. Recover by running audit mode long enough to inventory
  what's actually out there, then fixing forward.
- **Merging the workload and platform planes.** It looks simpler and
  it couples policy changes to release calendars. Recover by splitting
  the repositories out loud and naming the owner of each.
- **Forgetting sync status is a signal.** A cluster silently stops
  reconciling and drifts for weeks. Recover by adding the sync-status
  alert before enabling anything else.
- **Using Config Connector as a general Terraform replacement.** It's
  excellent for workload-scoped resources and a poor fit for org-level
  infrastructure. Recover by drawing the ownership boundary explicitly.

**Follow-up probes the interviewer asks next**

1. **"Escalate this: your config repo gets a bad merge. What's the
   blast radius?"** — every cluster in the affected scope, within the
   reconciliation interval, which is minutes. That's why plane-two
   changes get a canary scope and why the repository has stricter
   review than a workload repo. It's also why cluster existence lives
   in Terraform — the worst a bad plane-two merge can do is misconfig,
   not deletion.
2. **"A team needs a DaemonSet for their own tooling. Yours or
   theirs?"** — mine, because a DaemonSet is cluster-level privilege
   wearing a workload costume. I'd take the request, review it, and
   deliver it through plane two rather than granting the access.
3. **"What if some clusters are outside Google Cloud?"** — that's the
   GKE Enterprise fleet case; the same config delivery model reaches
   them, and the interesting difference is that the network and
   identity assumptions in the baseline scope may not hold, so those
   clusters usually need their own scope rather than the baseline.
4. **"Who owns the platform config repository in two years?"** — the
   platform team, with a review requirement that includes at least one
   person outside it, because a repository that reaches every cluster
   with one approval is a standing risk regardless of who holds it.
5. **"How do you prove to an auditor that policy is applied?"** — the
   fleet's per-cluster sync and constraint-violation status, exported
   to the same monitoring and logging projects everything else uses.
   The evidence is continuous rather than a point-in-time screenshot,
   which is a stronger claim and easier to produce.
6. **"What breaks if you double the cluster count?"** — not the
   delivery model, which is scope-based. What breaks is reconciliation
   load and the human review capacity on one repository. At that size
   I'd split the repository by scope with separate ownership rather
   than adding reviewers to one bottleneck.

**Cross-references**

- `02-services/07-devops-cicd.md` — Config Connector and Terraform
  positioning; `02-services/01-compute.md` for GKE Standard versus
  Autopilot, which changes what plane two can configure.
- `03-comparisons/01-compute-options.md` — the Autopilot supported-
  configuration subset constrains several plane-two objects.
- `D6-Q02` for the standardization line this is one instance of;
  `D6-Q06` for why a policy rollout is a progressive delivery problem.

---

### D6-Q04 — "A new service goes live. Where do its dashboards, SLOs and alerts come from?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 6.1, 5.2 |
| **Axis** | operations |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D6-Q01` |

**What the interviewer is actually testing**

Whether observability is part of the service or a thing people do
afterwards. The tell is how you answer "who writes the alert" — if the
answer is a person, at some point one service won't have any and
nobody will find out until it's down. The strong answer makes
observability an artifact the pipeline emits.

**Clarifying questions to ask before drawing anything**

- **Does the service have a stated SLO, or just an intention?** An SLO
  with a number and a window is something I can provision. "It should
  be reliable" is not, and I'd rather have a deliberately loose number
  than none.
- **Who gets paged for this service?** The alert routing is part of
  the definition, and if the answer is "the platform team" for a
  product service, I have an ownership problem before I have a
  monitoring problem.
- **Are the SLIs derivable from platform signals, or do they need
  application instrumentation?** Request-rate and latency at the load
  balancer are free. "Did the customer's order actually complete" is
  not, and it's usually the one that matters.
- **How many monitoring scopes are we dealing with?** If every project
  is its own scope, cross-service views are painful. I'd want a
  deliberate scoping decision before writing any dashboard.
- **Is anyone allowed to edit alerts in the console?** If yes, then
  code isn't the source of truth and I need to close that before this
  design means anything.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Every service has an SLO at launch | Stated | — | SLO definition becomes a launch gate, not a follow-up |
| Alerts are code, not console clicks | Assumed | "I'll assume console edits get reverted — otherwise nothing here is durable" | Terraform is the source of truth, drift is reverted |
| Routing is derived from ownership metadata | Assumed | "I'd rather derive the on-call target from the manifest than maintain a routing table" | Ownership changes propagate automatically |
| Cross-service views are needed during incidents | Assumed | "Otherwise every incident starts with hunting for the right project" | Drives a shared monitoring scope in `prj-common-scc` |
| Custom metric cardinality must stay bounded | Assumed | "High-cardinality custom metrics are the usual surprise cost here" | Cardinality becomes a reviewed property of the service manifest |

**The answer, out loud**

The service manifest from `D6-Q01` carries the SLO, and the pipeline
provisions the observability from it. That's the whole answer in one
sentence, and everything else is what that implies.

Concretely, when a service is registered, its manifest declares an
availability target and a latency target with a window — say
ninety-nine point nine percent of requests succeeding over a rolling
twenty-eight days, and a ninety-fifth-percentile latency threshold.
The pipeline turns that into three things in Cloud Monitoring: an SLO
object with its SLI definition, a dashboard from a standard template
bound to that service's resources, and a pair of burn-rate alerting
policies. Those artifacts are Terraform, generated from the manifest,
applied by the same run that creates the service's other resources.
Nobody writes them by hand and nobody forgets.

I'd be specific about the alerts, because this is where most
observability designs go wrong. I'd provision exactly two alerting
policies per SLO by default, not twelve. A fast burn-rate alert that
pages when the budget is being consumed quickly enough that the
service will breach its window within hours, and a slow burn-rate
alert that files a ticket when the budget is eroding steadily without
being dramatic. The distinction between page and ticket is the point:
the fast one is "something is happening now," the slow one is
"something is wrong and you should look at it this week." Anything
beyond those two has to be justified per service, because the third
alert is where alert fatigue starts (`D6-Q10`).

I'd add one non-SLO alert by default, though, and I'd call it out as
the exception: absence of signal. A threshold alert can never fire if
there's no data to threshold against, so a service that dies
completely and stops emitting looks identical to a service with
perfect health. Every provisioned service gets an absence alert for
its primary metric stream.

On SLI sourcing: I'd use platform signals wherever they're honest.
Load-balancer request counts and latency distributions are free, they
don't require the application to cooperate, and they survive the
application being too broken to instrument itself. Where the
meaningful SLI is business-level — an order completing, a payment
settling — that needs application instrumentation, and I'd put a
bounded custom metric behind it. Bounded matters: a custom metric with
one time series per user identifier is a cost incident waiting to
happen, and I'd make cardinality a declared, reviewed property in the
manifest rather than something discovered on a bill.

Logs feed this too. A log-based metric lets us alert on a specific
error signature without shipping a code change, which is enormously
useful during an incident — I'd reserve it for exactly that, as an
incident-time tool that gets promoted to a proper metric if it turns
out to be permanent. Leaving temporary log-based metrics in place
forever is how the monitoring configuration becomes unreadable.

The last structural decision is scoping. I'd put a metrics scope in
`prj-common-scc` that includes every workload project, so that
incident responders have one place to build cross-service views
without hunting through projects. Teams still see their own project's
data natively; the shared scope is additive. And dashboards for the
golden-path services are generated, not hand-built, which means a
change to the template improves every service's dashboard at once —
the same compounding argument as base images in `D6-Q02`.

What I'd say unprompted is that this design's real value isn't the
dashboards. It's that a service cannot reach production without an SLO
that someone agreed to, because the pipeline has nothing to provision
otherwise. Making observability a build artifact turns "we should
define an SLO" from a good intention into a blocking condition, and
that's the actual behaviour change.

**Architecture**

```
  SERVICE MANIFEST (repo root)                            ◄── (1)
  ┌──────────────────────────────────────────────────────────┐
  │ slo: { availability: target+window, latency: p95+window } │
  │ owner-group · notification routing · metric cardinality    │
  └──────────────────────────┬───────────────────────────────┘
                             │ pipeline generates Terraform
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │              CLOUD MONITORING ARTIFACTS                   │
  │                                                           │
  │  (a) SLO OBJECT ── SLI definition + target + window ◄─(2) │
  │       │                                                   │
  │       ├──► FAST BURN ALERT   → PAGE          ◄── (3)      │
  │       │     budget draining fast enough to breach soon    │
  │       │                                                   │
  │       └──► SLOW BURN ALERT   → TICKET        ◄── (4)      │
  │             steady erosion, investigate this week         │
  │                                                           │
  │  (b) ABSENCE-OF-SIGNAL ALERT → PAGE          ◄── (5)      │
  │       the only non-SLO alert provisioned by default       │
  │                                                           │
  │  (c) DASHBOARD from shared template          ◄── (6)      │
  │       template change improves every service at once      │
  └──────────────────────────┬───────────────────────────────┘
                             │
      SLI SOURCES            ▼
  ┌─────────────────────────────┬────────────────────────────┐
  │ PLATFORM SIGNALS (free)     │ APPLICATION SIGNALS         │
  │ LB request count, latency,  │ bounded custom metrics for  │
  │ error rate — survive the    │ business-level SLIs  ◄─(7)  │
  │ app being too broken to     │ cardinality declared and    │
  │ instrument itself   ◄─ (8)  │ reviewed, not discovered    │
  └─────────────────────────────┴────────────────────────────┘

  LOG-BASED METRICS — incident-time tool, promoted or removed  ◄─(9)

  Cross-cutting: a metrics scope in prj-common-scc spans every workload
  project so responders build cross-service views without project
  hunting; console edits are reverted by the next Terraform run (10).
```

**Every arrow explained:**

1. **Manifest as the observability source** — the same file the
   pipeline already reads. Wrong alternative: a separate monitoring
   repository, which drifts from the service it describes.
2. **SLO object, not a bare threshold** — error-budget consumption is
   tracked by the platform rather than computed in a spreadsheet,
   which is what makes `D6-Q05`'s budget policy enforceable.
3. **Fast burn alert pages** — the budget is draining quickly enough
   that the window will breach. This is the only routine page.
4. **Slow burn alert tickets** — steady erosion deserves attention,
   not adrenaline. Paging on slow burn is the most common cause of
   on-call fatigue in an otherwise sound design.
5. **Absence-of-signal alert** — the one default alert that isn't
   SLO-derived, because a dead service emits no data to threshold.
6. **Generated dashboards** — template improvements compound across
   the estate. Hand-built dashboards decay to whoever last had an
   incident.
7. **Bounded custom metrics for business SLIs** — declared cardinality
   in the manifest. Unbounded cardinality is the classic surprise in
   monitoring spend.
8. **Platform signals preferred where honest** — they keep working
   when the application can't instrument itself, which is exactly the
   moment you need them.
9. **Log-based metrics as an incident-time tool** — fast to add
   without a code change; either promoted to a real metric or removed
   when the incident closes.
10. **Shared metrics scope plus reverted console edits** — one place
    for cross-service views, and code stays the source of truth.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Where alerts come from | Generated from the service manifest | Teams author their own alerting policies | No service can ship without observability, and template changes compound | When a service's SLI is genuinely unusual and templating it produces nonsense — then hand-authored, still in code, still reviewed |
| Default alert count | Two burn-rate alerts plus absence | A comprehensive alert set per resource type | Every additional default alert is charged to every service's on-call | When the service is a platform dependency with distinct failure modes (`D6-Q15`) — then more alerts, deliberately chosen |
| SLI source | Platform signals first, application metrics where meaningful | Application-emitted metrics for everything | Platform signals survive the failure modes application metrics don't | When the meaningful failure is invisible at the edge — a request that returns success with wrong data — then the application metric is the only honest one |
| Dashboard authorship | Generated from a shared template | Per-team hand-built dashboards | One improvement reaches every service; new services start complete | When a team has a genuinely bespoke operational model and the template misleads them — then theirs, and feed the learnings back into the template |
| Monitoring scope | Shared scope across workload projects | Per-project scopes only | Incident responders don't hunt across projects mid-incident | When data sensitivity means one team's metrics must not be visible org-wide — then scope by folder, not org-wide |

**Making it concrete**

```hcl
# Provisioned from the manifest — the SLO exists because the service
# exists, not because someone remembered to create it.
resource "google_monitoring_slo" "availability" {
  service      = google_monitoring_service.svc.service_id
  slo_id       = "availability-28d"
  goal         = 0.999
  rolling_period_days = 28
  request_based_sli {
    good_total_ratio {
      good_service_filter  = "metric.type=\"loadbalancing.googleapis.com/https/request_count\" metric.label.response_code_class=\"200\""
      total_service_filter = "metric.type=\"loadbalancing.googleapis.com/https/request_count\""
    }
  }
}
```

Both filters come from load-balancer metrics rather than application
instrumentation, which means this SLO keeps reporting accurately even
when the service is too broken to emit its own telemetry — the
property that matters most on the worst day.

**What a weak answer sounds like**

- "The team sets up monitoring after launch." — then some service
  won't have any, and you'll learn which one from a customer.
- "We have a dashboard with all the key metrics." — a dashboard is not
  an alert; the panel is listening for what wakes someone up and what
  doesn't.
- "We alert on CPU above eighty percent." — a resource threshold is a
  proxy for a symptom nobody experiences; customers feel errors and
  latency, not CPU.
- "Every metric gets an alert so nothing is missed." — this is how you
  get an on-call rotation that has learned to ignore its pager, which
  is strictly worse than fewer alerts.

**Common wrong turns**

- **Paging on slow burn.** It feels responsible and it burns the
  rotation out within a quarter. Recover by splitting the two policies
  explicitly and routing them differently.
- **Skipping absence-of-signal.** Every threshold is fine when there's
  no data. Recover by adding it as a default before anything else.
- **Unbounded custom metric cardinality.** One time series per user
  looks harmless in staging. Recover by declaring cardinality in the
  manifest and reviewing it like any other resource request.
- **Letting console edits stand.** Someone silences an alert during an
  incident and it stays silenced. Recover by reverting on the next
  apply and making the silence itself a declared, expiring artifact.

**Follow-up probes the interviewer asks next**

1. **"A team says their generated dashboard is useless for them. What
   do you do?"** — ask what they look at during an incident and add it
   to the template if it generalises, or let them extend theirs if it
   doesn't. The failure mode to avoid is a template nobody uses and a
   set of hand-built dashboards nobody maintains.
2. **"Escalate this: the monitoring project itself has an issue. What
   do you lose?"** — visibility across every service simultaneously,
   which is the worst possible time to lose it. That's why
   `prj-common-logging` and the monitoring scope are separate concerns
   with separate blast radius (`D1-Q13`), and why I'd want at least a
   minimal independent check — an external uptime check on the top few
   customer-facing endpoints that doesn't depend on the same control
   plane.
3. **"How do you stop monitoring spend from growing without bound?"** —
   log exclusions for high-volume low-value entries, cardinality
   review at manifest time, and a sink to cheaper storage for anything
   retained for compliance rather than operations. It's the same
   lever set as `D6-Q12`, applied to telemetry.
4. **"Who owns the alert when a team reorganises?"** — the manifest's
   owner group, which is the same group the IAM model uses, so
   ownership changes in one place. If routing lived in a separate
   table, it would be stale the week after any reorg.
5. **"What's the first thing you'd remove from an existing
   over-alerted system?"** — every alert that has fired more than a
   few times without anyone taking an action. That list is usually
   most of them, and deleting it is the highest-leverage change
   available (`D6-Q10`).
6. **"How do you handle a service whose SLO nobody will commit to?"** —
   set a deliberately loose one and publish it. A loose, agreed number
   beats an unstated ideal, because it can be tightened with evidence
   and it makes the conversation concrete.

**Cross-references**

- `02-services/06-management-operations.md` — Cloud Monitoring SLO
  objects, absence-of-signal alerting and log-based metrics
  configuration depth; don't re-derive them.
- `03-comparisons/05-ha-dr-strategies.md` — the fast versus slow
  burn-rate distinction and its relationship to HA/DR tier is defined
  there; this question implements it.
- `D6-Q05` for the error-budget policy these SLOs feed; `D6-Q10` for
  what happens to the alerts once they exist.

---

### D6-Q05 — "You want error budgets to actually govern behaviour across teams that don't share a manager. How?"

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 6.1, 4.2, 4.3 |
| **Axis** | operations |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D6-Q04` |

**What the interviewer is actually testing**

Whether you understand that an error budget is an agreement, not a
metric. The technical half is solved — Cloud Monitoring tracks budget
consumption automatically. The question is what happens when a budget
is exhausted and the team that exhausted it reports to someone who
doesn't care about your policy. This is a principal-band question
because the answer is mostly organizational design.

**Clarifying questions to ask before drawing anything**

- **Who currently decides whether a release ships during an
  incident-heavy week?** If that's already a person with authority,
  the error budget formalises their judgment. If nobody decides, I'm
  introducing a decision right as well as a mechanism.
- **Is there an executive sponsor who will back a freeze?** Without
  one, the first time a budget stops a launch, the budget loses. I'd
  rather know that before designing than after.
- **Do the SLOs reflect what customers actually experience?** A budget
  policy on a badly-chosen SLI creates conflict without improving
  anything, and it discredits the whole idea.
- **Whose budget is it when service A's outage is caused by service
  B?** This is the question that decides whether the model survives
  contact with a dependency graph, and I'd want to answer it up front.
- **What's the smallest commitment leadership would actually sign?**
  I'd rather ship a weak policy that's genuinely honoured than a
  strong one that's ignored the first time it's inconvenient.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Teams report through different management chains | Stated | — | Enforcement can't rely on a shared manager; it has to be mechanism plus visibility |
| SLOs already exist and are provisioned in code | Assumed | "From the observability-as-code model — otherwise this has nothing to stand on" | Budget consumption is computed by the platform, not negotiated |
| Leadership will back the policy at least once | Assumed | "I'd want that commitment before launching this, not after the first conflict" | The first enforcement event determines whether the policy is real |
| Dependencies exist between team services | Assumed | "There's always a shared platform dependency in the path" | Requires an attribution rule for borrowed budget |
| The policy applies to the platform team too | Assumed | "Otherwise the teams being governed will notice, immediately" | Platform SLOs are published on the same terms (`D6-Q15`) |

**The answer, out loud**

I'd say up front that the mechanism is easy and the agreement is hard,
and that I'd spend most of the design effort on the agreement.

The mechanism: each service has an SLO with a rolling window, and
Cloud Monitoring tracks how much of the error budget has been
consumed. The budget number is not the interesting part. What's
interesting is what different levels of consumption *authorise* —
because an error budget is really a pre-negotiated decision about how
to spend risk, made calmly, so it doesn't have to be made during an
argument.

I'd define four states with pre-agreed consequences. Healthy budget,
above roughly half remaining: ship freely, the team decides everything
about its own release cadence. Depleting, under half: the team's own
review, no external involvement, but the state is visible on a shared
dashboard. Nearly exhausted, under a quarter: new feature releases
pause; reliability work and rollback-safe changes continue. Exhausted:
a freeze on feature releases for that service until the budget
recovers or an explicit, time-boxed exception is granted by a named
person.

The critical design decision is that the freeze is scoped to the
service, not the team and not the org. That keeps the consequence
proportionate and it keeps the policy defensible — I'm not stopping a
team from working, I'm stopping one service from shipping features
while it's demonstrably unreliable. A team-wide or org-wide freeze is
where budget policies acquire their reputation for being punitive and
get quietly abandoned.

Now the part that actually matters across management chains. Without a
shared manager, I have three levers, and I'd use them in this order.
First, visibility: one dashboard showing every service's budget state,
visible to everyone including leadership, updated automatically.
Nothing changes behaviour among engineers faster than their reliability
state being legible to their peers. Second, mechanism: the promotion
gate in `D6-Q01` reads budget state and won't promote a feature
release for an exhausted service. That's not a person saying no, it's
the pipeline declining, which removes the interpersonal cost of
enforcement entirely. Third, and only as backstop, escalation: a named
executive who has agreed in advance to back the policy. I'd want that
commitment secured before launch, and I'd spend it rarely.

The dependency question is the one that breaks most implementations,
so I'd answer it explicitly. When service A breaches because its
dependency B failed, the budget consumption lands on A — A's customers
experienced A being down, and pretending otherwise makes the SLO
dishonest. But the *incident* is attributed to B, and B's own SLO
should show a corresponding breach. If B's SLO doesn't move when B
takes A down, B's SLO is measuring the wrong thing, and that mismatch
is one of the most useful diagnostics the whole system produces. I'd
also let A file what amounts to a claim: a documented request that the
consumed budget not count toward A's freeze threshold, granted by the
same named person who grants exceptions. That gives A a path that
isn't "argue with B's manager."

Finally, the policy has to apply to the platform team. If platform
services publish SLOs on the same terms and freeze on the same rules,
the policy reads as a shared discipline. If platform is exempt, it
reads as something done to product teams, and it will be resisted
exactly that way. That's `D6-Q15`, and I'd raise it unprompted here
because volunteering it is most of what makes the policy credible.

**Architecture**

```
  BUDGET STATE ──► WHAT IT AUTHORISES (pre-agreed, not negotiated
                   in the moment)                          ◄── (1)

  ┌──────────────┬────────────────────────────────────────────┐
  │ > ~50% left  │ SHIP FREELY — team decides everything      │
  ├──────────────┼────────────────────────────────────────────┤
  │ < ~50% left  │ TEAM REVIEW — internal, state is visible   │ ◄─(2)
  ├──────────────┼────────────────────────────────────────────┤
  │ < ~25% left  │ FEATURE RELEASES PAUSE — reliability and   │
  │              │ rollback-safe changes continue      ◄─(3)  │
  ├──────────────┼────────────────────────────────────────────┤
  │ exhausted    │ FEATURE FREEZE, SCOPED TO THE SERVICE      │ ◄─(4)
  │              │ not the team, not the org                  │
  └──────────────┴────────────────────────────────────────────┘

  THREE LEVERS, IN THIS ORDER — no shared manager exists
  ┌────────────────────────────────────────────────────────────┐
  │ 1. VISIBILITY   one dashboard, every service, everyone     │ ◄─(5)
  │                 including leadership, updated automatically │
  │ 2. MECHANISM    promotion gate declines — the pipeline      │ ◄─(6)
  │                 says no, not a person                       │
  │ 3. ESCALATION   named exec, committed in advance, spent     │ ◄─(7)
  │                 rarely — backstop only                      │
  └────────────────────────────────────────────────────────────┘

  DEPENDENCY ATTRIBUTION — the rule that decides if this survives
  ┌────────────────────────────────────────────────────────────┐
  │ A breaches because B failed:                                │
  │   budget consumed  → A  (A's customers felt A be down) ◄(8) │
  │   incident owned   → B  (and B's SLO should move too)       │
  │   if B's SLO DOESN'T move → B is measuring the wrong thing  │
  │   A may file a documented claim → same exception path  ◄(9) │
  └────────────────────────────────────────────────────────────┘

  Cross-cutting: platform services publish SLOs and freeze on the same
  rules — exemption is what makes the policy read as punitive (10).
```

**Every arrow explained:**

1. **States authorise actions, pre-agreed** — the budget's job is to
   move a decision out of the argument and into a calm moment before
   it. A budget with no stated consequence is a metric, not a policy.
2. **Depleting is visible but not escalated** — the visibility alone
   changes behaviour, and escalating this early spends credibility on
   the wrong cases.
3. **Feature pause, not a full stop** — reliability work continuing is
   what makes recovery possible. A blanket stop leaves the team unable
   to fix the thing that caused the state.
4. **Freeze scoped to the service** — proportionate and defensible.
   Wrong alternative: team-wide or org-wide freezes, which generate
   enough collateral resentment to get the policy killed.
5. **Visibility first** — legibility among peers changes behaviour
   faster than any policy document, and it costs nothing to build once
   SLOs are code (`D6-Q04`).
6. **Mechanism second** — the pipeline declining removes the
   interpersonal cost of enforcement, which is the actual barrier when
   there's no shared manager.
7. **Escalation last, and pre-committed** — an executive who agrees to
   back the policy only after the first conflict will not back it.
8. **Budget lands on the service whose customers suffered** — anything
   else makes the SLO dishonest about customer experience.
9. **A documented claim path** — gives the depending team a route that
   isn't an argument with another chain of management.
10. **Platform is not exempt** — volunteering this is most of what
    makes the policy credible to the teams it governs.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Freeze scope | The individual service | The whole team, or the org | Proportionate, defensible, and doesn't create collateral resentment | When a team's services share one deployment unit and can't be frozen separately — then team scope, and say so up front |
| Primary enforcement | Automated promotion gate | A person who says no | Removes the interpersonal cost of enforcement across management chains | When the culture genuinely runs on negotiated judgment and an automated block reads as hostile — then a person, with the dashboard as their evidence |
| Dependency attribution | Budget on the affected service, incident on the cause | Exempt the affected service automatically | Keeps every SLO honest about what customers experienced | When the dependency is a platform service and the pattern is systemic — then a standing adjustment, published, not a per-incident claim |
| Policy launch | Weak policy that's honoured | Strong policy leadership hasn't committed to | The first enforcement event determines whether the policy is ever real | When leadership has genuinely pre-committed and the org expects strong governance — then start strong, because starting weak wastes the mandate |
| Platform exemption | None — platform freezes too | Exempt platform for availability reasons | Credibility with the teams being governed is the scarce resource | When a platform service is mid-incident and freezing it would prevent the fix — that's the same reliability-work carve-out every service gets |

**What a weak answer sounds like**

- "We'd track error budgets in Cloud Monitoring." — that's the easy
  half; the panel is asking what happens when one runs out.
- "If the budget is exhausted, we stop all releases." — org-wide
  freezes are how budget policies get abandoned after their first use.
- "The SRE team would enforce it." — without a shared manager, one
  team telling another team's engineers no is a conflict generator;
  the mechanism has to do the enforcing.
- "Teams set their own budgets and police themselves." — then the
  budget is whatever is convenient, and it stops meaning anything the
  first time it's inconvenient.

**Common wrong turns**

- **Launching without an executive pre-commitment.** The first freeze
  meets a launch deadline and the policy loses. Recover by getting the
  commitment before the first enforcement, not during it.
- **Designing the consequence before the SLI is trustworthy.** A
  budget policy on a bad SLI generates conflict and no reliability.
  Recover by running the SLOs in observation mode for a window and
  fixing the ones that don't match customer experience.
- **Making platform exempt.** Rational-sounding, and it reframes the
  whole policy as something done to product teams. Recover by
  publishing platform SLOs on the same dashboard on day one.
- **Treating exhaustion as blame.** Budgets exist to be spent; a
  service that never uses its budget is over-provisioned. Recover by
  saying that out loud early, repeatedly.

**Follow-up probes the interviewer asks next**

1. **"A VP wants their launch to ship despite an exhausted budget.
   What happens?"** — the exception path runs: named person, time-
   boxed, documented, with a stated reliability commitment attached.
   I'd grant it more often than people expect, because a policy with
   no exception path gets routed around rather than argued with. What
   I'd insist on is that the exception is recorded and visible.
2. **"Escalate this: every service is over budget at once. Now
   what?"** — that's not forty team problems, it's one platform
   problem, and I'd stop applying the per-service policy entirely
   while it's true. Freezing the whole estate because a shared
   dependency is degraded punishes the wrong people; the correct
   response is a platform incident (`D6-Q15`).
3. **"How do you stop teams from setting weak SLOs to avoid
   freezes?"** — publish the SLO alongside the actual performance.
   A service running at four nines against a two-nines target is
   visibly sandbagging, and that comparison is more effective than any
   approval process on targets.
4. **"Who owns this policy in two years?"** — a reliability function
   with a named owner, reviewed annually with the teams. If it's owned
   by nobody, the thresholds drift toward whatever avoided the last
   argument.
5. **"What if a team simply ignores it?"** — then the mechanism has to
   hold, which is why the promotion gate matters more than the policy
   document. If a team can ship while frozen, the policy was
   decoration. If they can't, the conversation moves to the exception
   path, which is where I wanted it.
6. **"What would you measure to know this is working?"** — not the
   number of freezes. I'd watch whether reliability work gets
   scheduled *before* exhaustion, which is the behaviour the policy is
   actually for. Frequent freezes mean the mechanism works and the
   behaviour hasn't changed yet.

**Cross-references**

- `03-comparisons/05-ha-dr-strategies.md` — the fast/slow burn-rate
  distinction and why a generous HA/DR tier doesn't substitute for
  SLO monitoring; this question builds on that, doesn't restate it.
- `D6-Q04` for the SLOs this policy consumes; `D6-Q15` for the
  platform's own published SLOs; `D6-Q01` for the promotion gate that
  does the enforcing.
- `D1-Q16` — architecture governance, for the forum that ratifies
  threshold changes without becoming a bottleneck.

---

### D6-Q06 — "Design the production rollout. Canary or blue-green, what signal decides, and who presses the rollback button?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 4.3, 6.2 |
| **Axis** | operations |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D6-Q01`, `D6-Q04` |

**What the interviewer is actually testing**

Whether you know that the rollout strategy is the easy part and the
*decision signal* is the hard part. Everybody can describe a ten
percent canary. The question is what number, measured over what
window, compared against what baseline, makes the rollout continue or
reverse — and whether that decision needs a human at all.

**Clarifying questions to ask before drawing anything**

- **Does this release include a schema change?** That single fact
  changes everything. A stateless code change is trivially reversible;
  a migration that drops a column is not, and no rollout strategy
  rescues an irreversible data change.
- **What traffic volume does the service see?** A canary needs enough
  requests in the window to produce a statistically meaningful error
  rate. On a low-traffic internal service, a five percent canary for
  ten minutes tells you nothing, and I'd use a different shape.
- **Is there per-user session affinity or in-memory state?** If a user
  can be served by both versions and that breaks them, I need
  consistent routing or blue-green rather than a percentage split.
- **What does the service's SLI actually measure?** The rollback signal
  should be the same SLI the SLO uses, otherwise I'm rolling back on
  something customers don't feel and shipping things they do.
- **How long can two versions coexist?** Blue-green needs double
  capacity briefly; canary needs both versions compatible with the
  same downstream contracts for the duration.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Rollback without waking the author | Stated | — | The decision must be automated from measurable signals |
| Releases are backwards-compatible by default | Assumed | "I'll assume we hold the compatibility discipline — if we don't, canary isn't safe at all" | Two versions serving simultaneously must be a supported state |
| Service traffic is high enough for statistics | Assumed | "Otherwise the canary window is too short to mean anything and I'd switch strategy" | Determines canary versus blue-green |
| Rollback target is the previous release | Assumed | "Rolling forward through a fix is slower than reverting, and slower is the cost" | Cloud Deploy keeps the prior release ready |
| Schema changes are separated from code changes | Assumed | "Otherwise rollback is a data problem, not a deployment one" | Migrations become their own release, expand-then-contract |

**The answer, out loud**

I'd default to canary and reserve blue-green for two specific
situations, and I'd say which up front because a panel that hears
"it depends" without the conditions has learned nothing.

Canary is my default because it limits exposure proportionally and it
produces a comparison. A percentage of real traffic hits the new
version while the rest hits the old, and I get two populations
measured simultaneously under identical conditions — same time of day,
same traffic mix, same downstream weather. That comparison is far more
trustworthy than comparing today's new version against yesterday's
old one, because it controls for everything that changed other than
the release.

I'd switch to blue-green in two cases. First, when two versions can't
safely coexist — an in-memory protocol change, a cache format change,
anything where a user hitting both versions breaks. Second, when
traffic is too low for a canary to be statistically meaningful; on a
service that sees a few hundred requests an hour, a canary slice
measures noise, and a full switch with a fast revert is more honest
about what you actually know.

The rollout shape I'd configure for a normal service is a small
initial slice with a bake period, then a wider slice, then full. The
first slice exists to catch the things that fail immediately —
crash-loops, missing configuration, a dependency the new version
can't reach. The second slice exists to catch the things that need
volume: a slow memory leak, a connection pool exhausting, a
downstream rate limit. Different failure classes appear at different
scales, which is why a single jump from ten percent to a hundred is
worse than two smaller steps even though it's faster.

Now the part that matters: the signal. I'd compare the canary
population against the stable population on exactly the SLIs the
service's SLO uses — error ratio and latency at the same percentile —
plus two more that aren't SLIs but are leading indicators: the
container restart count and the rate of a specific severity in the
logs. The comparison is relative, not absolute: the canary fails if
its error ratio is meaningfully worse than stable's *at the same
moment*, not if it crosses a fixed threshold. Fixed thresholds fail
during an unrelated incident, which is exactly when you least want a
spurious rollback.

Rollback is automatic and it happens before notification. Cloud Deploy
reverts to the previous release, the deploy annotation records that it
happened and why, and then a message goes to the team's channel. I'd
push back hard on the version where a human is paged to approve the
rollback, because the human will approve it every time and the only
thing their involvement adds is however long it takes them to reach a
laptop. The exception is where rollback itself is dangerous, and the
correct response to that is to make it not dangerous rather than to
add an approver.

Which brings me to the thing I'd raise unprompted: schema changes.
Progressive delivery only works if every release is reversible, and
the usual thing that breaks reversibility is a database migration. So
I'd separate them structurally — a migration is its own release that
only ever adds, the code release follows and uses the new shape, and
the removal of the old shape is a third release that ships a cycle
later once nothing references it. Three releases instead of one, and
in exchange every one of them is independently revertible. Teams
resist this until the first time they need to roll back at 2am.

The last piece is that this applies to platform changes too. A
cluster-level policy change, a base image bump, a Terraform module
version — those are production changes with a larger blast radius than
most product releases, and they get canary cohorts and automated
revert signals for the same reasons (`D6-Q02`, `D6-Q03`).

**Architecture**

```
  RELEASE N-1 SERVING 100%                          stable population
        │
        ▼
  STEP 1 — DEPLOY CANARY, SMALL SLICE                        ◄── (1)
  ┌──────────────────────────────────────────────────────────────┐
  │ new revision receives a small % of real traffic              │
  │ CATCHES: crash-loop, missing config, unreachable dependency  │
  └───────────────────────────┬──────────────────────────────────┘
                              │  bake window
                              ▼
  STEP 2 — COMPARE, DON'T THRESHOLD                          ◄── (2)
  ┌──────────────────────────────────────────────────────────────┐
  │ canary vs STABLE at the same moment, on the SLO's own SLIs:  │
  │   error ratio · latency at the SLO percentile        ◄── (3) │
  │ plus leading indicators, not SLIs:                            │
  │   container restarts · log severity rate             ◄── (4) │
  │ relative comparison survives an unrelated incident   ◄── (5) │
  └───────────┬──────────────────────────────┬───────────────────┘
        WORSE │                              │ NOT WORSE
              ▼                              ▼
  ┌───────────────────────────┐   STEP 3 — WIDEN SLICE      ◄── (6)
  │ AUTOMATIC ROLLBACK  ◄─(7) │   ┌──────────────────────────────┐
  │ revert to release N-1     │   │ CATCHES: memory leak, pool   │
  │ record annotation + cause │   │ exhaustion, downstream rate  │
  │ THEN notify (not before)  │   │ limit — volume-dependent     │
  └───────────────────────────┘   └──────────────┬───────────────┘
                                                 ▼
                                  STEP 4 — 100%, N-1 KEPT WARM ◄─(8)

  STRATEGY SWITCH — use blue-green instead when:            ◄── (9)
   · two versions cannot safely coexist (protocol/cache format)
   · traffic is too low for a canary slice to mean anything

  REVERSIBILITY PRECONDITION — schema changes are their own releases
   expand → use → contract, three releases, each revertible   ◄─(10)
```

**Every arrow explained:**

1. **Small first slice** — catches the failure class that appears
   immediately and costs almost nothing to detect. Wrong alternative:
   starting at half, which exposes half your users to a crash-loop.
2. **Compare populations, don't threshold** — two populations measured
   at the same moment control for everything except the release.
3. **The SLO's own SLIs as the decision signal** — rolling back on
   something customers don't feel, while shipping something they do,
   is the most common mis-wiring here.
4. **Leading indicators alongside** — restarts and log severity move
   before the SLI does, buying minutes.
5. **Relative, not absolute** — a fixed threshold triggers a spurious
   rollback during an unrelated incident, which is precisely when you
   want the system to hold still.
6. **Second, wider slice** — volume-dependent failures need volume.
   One jump to full is faster and skips this class entirely.
7. **Automatic rollback, then notify** — the human would approve it
   every time; their involvement only adds MTTR.
8. **Previous release kept warm** — rollback is a routing change, not
   a redeploy, which is the difference between seconds and minutes.
9. **Blue-green for the two named cases** — coexistence impossibility
   and low traffic. Naming the conditions is what makes this a
   decision rather than a preference.
10. **Expand-use-contract migrations** — the precondition that makes
    every other guarantee on this diagram true.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Default strategy | Canary with two widening steps | Blue-green switch | Limits exposure proportionally and produces a controlled comparison | When two versions can't coexist, or traffic is too low for the canary slice to be statistically meaningful |
| Decision signal | Canary versus stable, same moment | Fixed absolute thresholds | Survives unrelated incidents and traffic-pattern changes | When there is no stable population to compare against — a first deployment, or a full blue-green switch — then absolute thresholds are all you have |
| Rollback authority | Automated, notify after | Page a human to approve | Removes the largest controllable component of MTTR | When rollback is genuinely risky and the risk can't be engineered away in this release — then human, and file the reversibility work |
| Rollback method | Route back to the warm previous release | Roll forward with a fix | Seconds versus a full build-test-deploy cycle under pressure | When the previous release is also broken, or a data change makes going back incorrect — then forward, deliberately, with the incident open |
| Schema changes | Separate expand/use/contract releases | One release containing code and migration | Every release stays independently revertible | When the migration is genuinely additive and trivially safe — then combining is fine, and say why out loud |

**Making it concrete**

```hcl
# The rollout shape and its automatic-revert posture are declared with
# the pipeline, so every service gets the same discipline by default.
resource "google_clouddeploy_target" "prod" {
  name             = "prod"
  project          = "prj-common-cicd"
  location         = "REGION"
  require_approval = false        # policy gate, not a person (D6-Q01)
  run { location = "projects/PROJECT_ID/locations/REGION" }
  execution_configs {
    usages            = ["RENDER", "DEPLOY", "VERIFY"]
    service_account   = "sa-deploy-prod@PROJECT_ID.iam.gserviceaccount.com"
  }
}
```

`VERIFY` is the step that matters here: the pipeline runs the
comparison as part of the rollout rather than leaving it to a
dashboard someone is supposed to be watching. A verification step that
exists but nobody wired to a signal is the most common gap in
otherwise well-built pipelines.

**What a weak answer sounds like**

- "We do a ten percent canary for fifteen minutes." — a shape with no
  signal; the panel's next question is what decides, and there's no
  answer.
- "We watch the dashboard during the rollout." — that's a person as a
  monitoring system, and it works right up until the rollout happens
  at 4pm on a Friday.
- "Blue-green is safer because you can switch back instantly." — it
  exposes a hundred percent of users to the new version for however
  long it takes to notice; instant rollback is not the same as limited
  exposure.
- "We'd roll forward — rollbacks cause more problems." — sometimes
  true, and stated as a general rule it means the team has never made
  rollback safe and has rationalised it.

**Common wrong turns**

- **Picking absolute thresholds.** They work in testing and produce
  false rollbacks in production during unrelated incidents. Recover by
  switching to a canary-versus-stable comparison mid-answer.
- **Forgetting the migration.** The whole design assumes reversibility
  and one schema change quietly voids it. Recover by naming
  expand-use-contract before the panel does.
- **A single widening step.** Fast, and it skips the volume-dependent
  failure class entirely. Recover by adding the second step and saying
  which failures each one catches.
- **Exempting platform changes.** A base image bump reaches every
  service and gets none of this discipline. Recover by applying the
  same cohort rollout to platform releases.

**Follow-up probes the interviewer asks next**

1. **"The canary looks fine but you get a customer complaint. What
   failed?"** — almost always an SLI that doesn't capture what the
   customer experiences: a request that returns success with wrong
   data, or a failure concentrated in one customer segment the
   aggregate hides. I'd add a segment dimension to the comparison
   rather than a new alert.
2. **"Escalate this: the rollout is fine per-service but your change
   was to a shared library used by thirty services. Now what?"** — the
   blast radius is the whole estate and per-service canaries don't see
   it, because each service canaries independently and each looks
   acceptable. I'd roll the library out as a cohort — a few services
   first, the rest after a soak — and add an estate-level aggregate
   signal, because the failure here is correlated rather than local.
3. **"What if the rollback itself fails?"** — then the previous
   release isn't actually warm, which is a pipeline defect I'd want
   caught by regularly exercising rollback rather than discovering it
   during an incident. That's a game-day item (`D6-Q08`).
4. **"Who owns the canary thresholds in two years?"** — the platform
   team owns the default comparison and each service owns its
   deviation, declared in the manifest. Thresholds that live in
   somebody's head drift toward whatever avoided the last false alarm.
5. **"How do you handle a release that must go out immediately for
   security reasons?"** — same pipeline, compressed bake, and an
   explicit recorded decision that the risk was accepted. I'd resist
   a separate emergency path, because the emergency path becomes the
   normal path.
6. **"What would make you stop canarying a service?"** — traffic too
   low to measure, or a service where every deploy is a full
   cutover anyway. Both are reasons to change strategy, not to
   abandon a decision signal.

**Cross-references**

- `02-services/07-devops-cicd.md` — Cloud Deploy canary strategies,
  approval gates and one-command rollback behaviour.
- `03-comparisons/01-compute-options.md` — the canary/traffic-split
  support row differs by compute option and constrains the shape.
- `D6-Q01` for where this sits in the path; `D6-Q14` for the regulated
  service that needs a variant of it.

---

### D6-Q07 — "Two hundred services, one DR program. Not every service deserves the same treatment. Design it."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 6.2, 4.1 |
| **Axis** | operations |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D6-Q05` |

**What the interviewer is actually testing**

Whether you can run DR as a *program* rather than as two hundred
individual designs. The per-service tier selection is a solved
question with a published matrix; what isn't solved is how you assign
two hundred services to tiers, keep the assignment honest as systems
change, and prove the plan works without a real disaster.

**Clarifying questions to ask before drawing anything**

- **Who is allowed to set a service's tier?** If every team self-
  selects, everything is critical. If a central group decides, it
  becomes a queue. I'd want the tier derived from a business-stated
  RTO/RPO with a named approver for the top tier only.
- **Has anyone ever tested a restore?** The honest answer is usually
  "some teams, sometimes." That answer tells me the program's first
  deliverable is drills, not design.
- **What's the dependency graph like?** A service can't be recovered
  faster than the things it depends on. If a top-tier service depends
  on a bottom-tier database, the tier assignment is fiction.
- **Is there a regulatory requirement for a tested, documented DR
  plan?** That changes drills from good practice to evidence
  production, which changes what the program has to emit.
- **What's the actual failure being planned for?** Regional outage,
  accidental deletion, and ransomware are three different plans, and a
  cross-region replica helps with exactly one of them.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Tiers come from stated RTO/RPO, not adjectives | Assumed | "I'd want a number per service — 'mission-critical' isn't a tier" | Tier assignment becomes derivable and auditable |
| Most services are not top-tier | Assumed | "If more than a small fraction land in the highest tier, the tiering failed" | Forces a cost-justified distribution |
| Backups exist but aren't verified | Assumed | "Almost universally true; unverified backups are the default state" | Restore drills become the first deliverable |
| Dependencies must be tier-consistent | Assumed | "A service is only as recoverable as what it depends on" | Adds a graph check to the assignment process |
| Drills produce evidence, not just confidence | Assumed | "Auditors want records; teams want confidence; the same drill can produce both" | Drill output is a stored artifact |

**The answer, out loud**

The tiers themselves I wouldn't invent — the four that matter are
Active-Active (multi-region), Active-Passive (hot standby), Warm
Standby, and Backup & Restore, in descending order of cost and
ascending order of recovery time. The comparison matrix in
`03-comparisons/05-ha-dr-strategies.md` covers what each one means at
each architecture layer. What this question is really asking is how
two hundred services get assigned and kept honest, so that's where I'd
spend the time.

Assignment starts from a number, not an adjective. Every service
declares an RTO and RPO in its manifest, stated by a business owner,
and the tier is *derived* from that pair rather than chosen. That
matters because "how critical is your service" gets one answer from
every team, while "how long can it be down before someone loses money,
and who is that someone" gets a distribution. Deriving the tier from
the number also means I can audit the assignment mechanically: any
service whose declared RTO doesn't match the tier its architecture
actually implements is a finding.

The second piece is the dependency check, and it's the one that
catches the most fiction. A service cannot recover faster than its
slowest dependency. So the program runs a graph check: for every
service, the minimum tier of everything it depends on, including
platform services, must be at least as strong as its own. When it
isn't, there are exactly two honest resolutions — raise the
dependency's tier, or lower the service's declared RTO to the truth.
I'd expect the first pass of this check to invalidate a meaningful
fraction of the tier assignments, and I'd present that as the
program's most valuable early output rather than as bad news.

Third, the mechanics. For everything in the Backup & Restore tier,
which will be the majority, I'd use the managed Backup and DR service
rather than per-team scripts, because the failure mode of hand-rolled
backup is a job that silently stops succeeding and nobody notices
until a restore is needed. Centralised policy means retention and
schedule are defined once per tier, and backup health is a monitored
signal rather than a thing each team remembers to check. Warm Standby
and above need the standby environment kept current, which is a
deployment problem rather than a backup problem — the standby has to
be a target of the same pipeline, or it drifts and the scale-up fails
when it's finally needed.

Fourth, and this is where most DR programs actually fail: drills. An
untested plan is a hypothesis. I'd set a drill cadence per tier —
frequent for the top tiers where failover is automated and cheap to
exercise, at least annual for Backup & Restore where a full restore
is the only real test. Each drill produces a stored artifact: what was
attempted, how long it took, whether the achieved recovery time met
the declared RTO, and what broke. The gap between declared and
achieved is the program's headline metric, because a service claiming
a one-hour RTO that drills at six hours is not a DR plan, it's a
statement of intent.

The last thing I'd say is about what DR does *not* cover, because
people conflate these. A cross-region replica protects against a
regional failure. It does not protect against a bad deployment,
because the bad deployment replicates. It does not protect against
accidental or malicious deletion, because the deletion replicates too.
Those need point-in-time recovery and immutable backups respectively,
and I'd make sure the program's tier definitions state which failures
each tier actually covers rather than letting "we have DR" stand in
for all three.

**Architecture**

```
  ASSIGNMENT — derive, don't choose
  ┌──────────────────────────────────────────────────────────────┐
  │ manifest: business-stated RTO + RPO, named business owner    │◄(1)
  │            │                                                 │
  │            ▼   derived, never self-selected                  │
  │  RTO/RPO ──► TIER  (names from 03-comparisons/05, unchanged) │◄(2)
  │    ~0 / ~0          → Active-Active (multi-region)           │
  │    minutes          → Active-Passive (hot standby)           │
  │    tens of min–hrs  → Warm Standby                           │
  │    hours–a day      → Backup & Restore   (the majority) ◄(3) │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  DEPENDENCY CHECK — the fiction detector                     ◄── (4)
  ┌──────────────────────────────────────────────────────────────┐
  │ for each service: min(tier of every dependency, incl.        │
  │ platform services) must be >= its own tier                   │
  │ violation → raise the dependency, or lower the claim   ◄ (5) │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  MECHANICS BY TIER
  ┌──────────────────────────┬───────────────────────────────────┐
  │ Backup & Restore         │ Backup and DR service, central    │
  │ (the majority)           │ policy per tier; backup HEALTH is │
  │                          │ a monitored signal          ◄(6)  │
  ├──────────────────────────┼───────────────────────────────────┤
  │ Warm Standby and above   │ standby is a PIPELINE TARGET, not │
  │                          │ a copy — otherwise it drifts ◄(7) │
  └──────────────────────────┴───────────────────────────────────┘
                              ▼
  DRILLS — cadence by tier, evidence as output               ◄── (8)
  ┌──────────────────────────────────────────────────────────────┐
  │ stored artifact per drill: attempted · elapsed · met RTO?    │
  │ HEADLINE METRIC = declared RTO minus achieved RTO      ◄(9)  │
  └──────────────────────────────────────────────────────────────┘

  SCOPE HONESTY — say what each tier does NOT cover          ◄─ (10)
   regional failure ≠ bad deploy (replicates) ≠ deletion (replicates)
```

**Every arrow explained:**

1. **Business-stated RTO/RPO with a named owner** — a number and a
   person. Without the person, the number drifts to zero.
2. **Tier derived, not chosen** — makes assignment auditable and stops
   every service being critical. Tier names come from the comparison
   file unchanged, so the program and the reference material can't
   diverge.
3. **The majority lands in Backup & Restore** — if that isn't true,
   the tiering hasn't done its job and the program's cost will reflect
   it.
4. **Dependency graph check** — a service is only as recoverable as
   what it depends on, including platform services (`D6-Q15`).
5. **Two honest resolutions only** — raise the dependency or lower the
   claim. The dishonest third option is leaving the mismatch in place
   and calling the service top-tier.
6. **Managed Backup and DR service with backup health monitored** —
   the classic failure is a backup job that silently stops. Per-team
   scripts make that invisible; centralised policy makes it a signal.
7. **Standby as a pipeline target** — a standby that isn't deployed to
   drifts, and the scale-up fails exactly when it's needed.
8. **Drill cadence by tier** — frequent where automated failover is
   cheap to exercise, at least annual where a full restore is the only
   real test.
9. **Declared minus achieved as the headline metric** — the single
   number that tells leadership whether the program is real.
10. **Stating what each tier doesn't cover** — replication propagates
    bad deploys and deletions; conflating those with regional failure
    is how a well-funded DR program still loses data.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Tier assignment | Derived from a stated RTO/RPO pair | Teams self-select their tier | Produces a distribution instead of two hundred critical services | When a regulator mandates a specific tier for a named system — then the tier is an input, and the RTO is documented to match |
| Backup mechanism | Managed Backup and DR service, central policy | Per-team backup automation | Backup health becomes one monitored surface instead of two hundred | When a workload type isn't supported by the managed service — then team-owned automation, with the same health signal required |
| Dependency mismatches | Raise the dependency or lower the claim | Accept the mismatch and document it | A documented mismatch is a top-tier service with a bottom-tier recovery time | When the dependency is genuinely optional at recovery time — then prove the degraded path works in a drill, don't assert it |
| Drill cadence | By tier, with stored evidence | Annual for everything | Frequent cheap drills on automated failover catch drift the annual one misses | When drills themselves are risky or expensive to run — then less often, and invest in making them cheaper |
| Standby currency | Standby is a deployment target | Periodic sync or image copy | The standby stays deployable because the pipeline keeps it so | When the standby is deliberately a cold artifact store — that's the Backup & Restore tier, and it should be labelled as such |

**Making it concrete**

```bash
# Backup policy is defined once per tier and attached by label, so a
# new service inherits its tier's retention rather than authoring one.
gcloud backup-dr backup-plans create tier-backup-restore \
  --project=PROJECT_ID \
  --location=REGION \
  --backup-vault=projects/PROJECT_ID/locations/REGION/backupVaults/vault-prod \
  --resource-type=compute.googleapis.com/Instance

# The health of the plan — not its existence — is what gets monitored.
gcloud monitoring policies list --project=PROJECT_ID \
  --filter='displayName~"backup freshness"'
```

The second command is the point. Every DR program has backup plans;
the ones that work have an alert that fires when a plan stops
producing fresh backups, because that is the failure that hides
longest and hurts most.

**What a weak answer sounds like**

- "Every service gets cross-region replication." — unaffordable, and
  it still doesn't protect against the two failure modes that
  replicate.
- "Teams decide their own RTO." — then every RTO is near zero, and the
  program has no way to prioritise.
- "We have backups, so we have DR." — backups without a tested restore
  are a hypothesis; the panel is listening for the drill.
- "The runbook covers failover." — a runbook nobody has executed this
  year has rotted, and the rot is invisible until the day it matters.

**Common wrong turns**

- **Designing per-service instead of building the assignment
  machine.** Two hundred bespoke DR designs is a decade of work.
  Recover by shifting to tiers, derivation, and a graph check.
- **Skipping the dependency graph.** The tier assignment looks
  complete and is partly fiction. Recover by running the check early
  and presenting the violations as the program's first finding.
- **Treating drills as optional once the design is done.** Design
  decay is invisible; only drills surface it. Recover by making drill
  cadence part of the tier definition rather than a separate program.
- **Conflating replication with protection from deletion.** The
  deletion replicates. Recover by stating per-tier coverage against
  each of the three failure classes explicitly.

**Follow-up probes the interviewer asks next**

1. **"A team's drill shows they miss their RTO by a factor of six.
   What happens?"** — either they invest to close the gap or the
   declared RTO changes to the achieved number, and the business owner
   signs the new number. What I wouldn't allow is the declared figure
   standing unchanged, because that's the state where everyone
   believes a recovery time that doesn't exist.
2. **"Escalate: a whole region is unavailable. How many of your two
   hundred services come back, and in what order?"** — the top two
   tiers come back automatically or with a promotion step; everything
   else is a queue, and the order is set by the dependency graph, not
   by who shouts. I'd have that ordering precomputed, because deriving
   it during an incident is how the first four hours disappear.
3. **"Who funds the top tier?"** — the business owner who stated the
   RTO, through the showback model in `D1-Q09`. Tier cost being
   visible to the person who chose it is what keeps the distribution
   honest over time.
4. **"How does a service change tier?"** — a declared change in the
   manifest, a new RTO signed by the business owner, and the
   architecture work to match. Tier drift without architecture change
   is the most common way a program quietly stops being true.
5. **"What's the first thing you'd do in week one?"** — pick the three
   services everyone assumes are top-tier and try to restore them. The
   results of that exercise will reorder the entire program's
   priorities and will also earn it the mandate it needs.
6. **"What if the platform itself is what failed?"** — then per-service
   DR doesn't help, because every service depends on it. That's the
   dependency-graph check applied to platform services, and it's
   `D6-Q15`.

**Cross-references**

- `03-comparisons/05-ha-dr-strategies.md` — the four tier names, their
  per-layer implementations, RTO/RPO mapping, the Backup and DR
  service comparison and the burn-rate tie-in. This question assumes
  all of it and restates none of it.
- `05-labs/lab-05-dr-failover-cloud-sql.md` — the hands-on version of
  a promotion drill.
- `D6-Q08` for turning drills into a standing program; `D6-Q15` for
  the platform's own recovery.

---

### D6-Q08 — "You want to run game days and fault injection against production. What has to be true of the architecture before that's a responsible idea?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 6.2, 4.1 |
| **Axis** | operations |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D6-Q07` |

**What the interviewer is actually testing**

Whether you treat chaos engineering as a maturity output rather than a
maturity input. Injecting faults into a system you can't observe, can't
stop quickly, and can't roll back is not an experiment, it's an
outage with a nicer name. The strong answer names the preconditions
before describing the experiments.

**Clarifying questions to ask before drawing anything**

- **Can we currently detect a failure we caused on purpose?** If the
  answer is "probably, eventually," the first game day should be a
  detection test rather than a fault injection.
- **Is there a way to stop an experiment immediately?** A blast-radius
  limiter and an abort that works without the person who started it is
  the minimum bar.
- **Who is on call during the window, and do they know?** A surprise
  game day is a different exercise and a much later one; the first
  dozen should be announced.
- **What do we already believe about this system?** The most valuable
  experiments test a stated belief — "we can lose a zone with no
  customer impact" — because a falsified belief is worth more than a
  confirmed one.
- **Is there a customer-impacting window we must avoid?** Every
  business has one, and running a game day inside it is how the
  program gets cancelled after its second session.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Experiments run in production eventually | Stated | — | Preconditions must be real, not aspirational |
| Every service has an SLO and burn-rate alerting | Assumed | "Otherwise we can't tell whether the experiment hurt anyone" | Observability is precondition one |
| Rollback and abort are automated | Assumed | "An experiment I can't stop without a human is not an experiment" | Abort path is precondition two |
| Blast radius can be bounded | Assumed | "A percentage of traffic, one zone, one tenant — something scoped" | Scoping is precondition three |
| There is an error budget to spend | Assumed | "Game days consume budget deliberately; that's the point of having one" | Ties the program to `D6-Q05` |

**The answer, out loud**

I'd put four preconditions on the board before I describe a single
experiment, because the order of this answer is the answer.

Precondition one is observability that would catch the failure. Every
service in scope has an SLO, burn-rate alerting, and an absence-of-
signal alert, which is `D6-Q04`. If I inject a fault and nothing
fires, I've learned something valuable — but I want that to be the
*finding*, not an accident. So the first game days I'd run aren't
fault injection at all; they're detection tests. Break something small
and deliberately, and measure how long until the right person knows.
That number is usually much worse than the team expects, and it costs
nothing to discover.

Precondition two is an abort that doesn't depend on the operator.
Every experiment gets a stated maximum duration and an automatic
termination when the service's burn rate crosses a threshold. The
person who started the experiment may be the person whose laptop
crashes; the abort has to be a property of the system.

Precondition three is a bounded blast radius the architecture can
actually express. This is where the architecture requirement becomes
concrete: I need to be able to scope an experiment to a slice of
traffic, a single zone, a single cell, or a single tenant, and I need
that scoping to be enforced by routing rather than by hoping. If the
architecture is one global pool with no partitioning, my only
experiment granularity is "everyone," and the program can't start in
production. That's a real finding and it's usually the first
architectural change the program motivates.

Precondition four is an error budget with room in it. Game days
consume budget on purpose, and running one against a service that's
already near exhaustion is spending money you don't have. I'd wire the
budget state into the scheduling: an experiment against a service in
the pause or freeze state doesn't run.

With those four true, the experiment sequence I'd run is layered.
Start with dependency failures, because they're the most common real
incident and the cheapest to simulate — make a downstream call fail or
slow down, and verify the caller degrades rather than cascades. Then
infrastructure: kill instances, drain a zone, and verify the
autoscaler and health checks behave as the design claims. Then the
control plane: what happens when the deployment pipeline is
unavailable, or the monitoring project is degraded — this is where
teams discover their recovery runbook depends on the thing that's
down. Then, and only then, region-level exercises, which overlap
directly with the DR drills in `D6-Q07` and should be run as the same
exercise rather than two programs.

What the architecture has to *expose* for this to be safe is three
things I'd name explicitly. First, a fault-injection surface that is
itself controlled — a mesh or proxy layer that can inject latency and
errors on a scoped route, with the injection configuration under the
same review as any other production change. Second, per-experiment
observability: the experiment must be an annotation on the same
dashboards the incident responders use, so someone who wasn't told
about the game day can immediately see that one is running. Third, a
kill switch that operates at a lower layer than the thing being
tested — a switch implemented inside the service under test is not a
kill switch.

And the output isn't confidence. It's a list of falsified beliefs with
owners and dates, fed into the same backlog as any other reliability
work. A game day that finds nothing and produces no items is either a
very mature system or a badly designed experiment, and in my
experience it's usually the second.

**Architecture**

```
  FOUR PRECONDITIONS — all four, before any production experiment
  ┌──────────────────────────────────────────────────────────────┐
  │ 1. OBSERVABILITY that would catch it: SLO + burn-rate +      │◄(1)
  │    absence-of-signal alerting on every service in scope      │
  │ 2. ABORT independent of the operator: max duration + auto-   │◄(2)
  │    terminate on burn-rate breach                             │
  │ 3. BOUNDED BLAST RADIUS the architecture can express:        │◄(3)
  │    traffic slice · zone · cell · tenant — enforced by        │
  │    routing, not by hoping                                    │
  │ 4. ERROR BUDGET with room: a service in pause/freeze state   │◄(4)
  │    is not scheduled (D6-Q05)                                 │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  EXPERIMENT LADDER — climb it in order                      ◄── (5)
  ┌──────────────────────────────────────────────────────────────┐
  │ RUNG 0  DETECTION TEST  — break something small, measure     │
  │         time-to-right-person. Run this first.          ◄(6)  │
  │ RUNG 1  DEPENDENCY      — downstream errors/latency: does    │
  │         the caller degrade or cascade?                       │
  │ RUNG 2  INFRASTRUCTURE  — instance kill, zone drain: do      │
  │         health checks and autoscaling behave as claimed?     │
  │ RUNG 3  CONTROL PLANE   — pipeline or monitoring degraded:   │
  │         does the runbook depend on what's down?        ◄(7)  │
  │ RUNG 4  REGION          — same exercise as the DR drill,     │
  │         not a second program                           ◄(8)  │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  WHAT THE ARCHITECTURE MUST EXPOSE
  ┌──────────────────────────────────────────────────────────────┐
  │ · scoped fault-injection surface, reviewed like prod config  │
  │ · experiment annotation on the responders' own dashboards ◄(9)│
  │ · kill switch BELOW the layer under test              ◄ (10) │
  └──────────────────────────────────────────────────────────────┘

  OUTPUT = falsified beliefs, with owners and dates — not confidence
```

**Every arrow explained:**

1. **Observability first** — without it the experiment produces an
   outage and no data. This is the precondition people skip because
   the tooling for injection is easier to acquire than the SLOs.
2. **Operator-independent abort** — the person who started it may be
   the person who can't stop it. Wrong alternative: a documented
   manual abort procedure.
3. **Architecturally expressible blast radius** — if the only
   granularity is "everyone," production experiments can't start, and
   that finding is itself worth the exercise.
4. **Budget-aware scheduling** — game days spend budget deliberately;
   spending it on a service already frozen is incoherent.
5. **A ladder, climbed in order** — each rung's failures are
   prerequisites for the next rung's experiment being interpretable.
6. **Detection test as rung zero** — cheapest, most revealing, and it
   builds the credibility the later rungs need.
7. **Control-plane rung** — where teams discover the recovery runbook
   depends on the system that's down. Almost always the most valuable
   single experiment.
8. **Region rung is the DR drill** — running these as one exercise
   halves the cost and stops the two programs from disagreeing.
9. **Experiment annotation on responders' dashboards** — someone who
   wasn't told must be able to see that a game day is running, within
   seconds.
10. **Kill switch below the layer under test** — a switch inside the
    service being broken is not a switch.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Where to start | Detection tests in production, announced | Fault injection in staging | Staging's failure modes and traffic don't match production's, so staging results don't transfer | When the preconditions genuinely aren't met yet — then staging, explicitly as practice for the team rather than as evidence about the system |
| Announcement | Announced for the first dozen exercises | Unannounced from the start | Builds trust and produces cleaner findings before testing the response process itself | When the thing under test *is* the response process and the team is mature — then unannounced, with leadership aware |
| Blast radius control | Enforced by routing | Bounded by the experiment's own logic | An experiment whose limiter is its own code fails open when the code is the problem | When the fault is injected outside the request path entirely — a background job, say — then logical bounding is what exists |
| Scheduling | Gated on error-budget state | Fixed calendar cadence | Doesn't spend budget a service can't afford | When the program is new and needs the discipline of a calendar — then fixed cadence, with a budget check as an override |
| Region exercises | Same exercise as the DR drill | Separate chaos and DR programs | One exercise, one set of findings, no contradictory conclusions | When the regulator requires a formally distinct DR test — then run it as a documented superset, not a duplicate |

**What a weak answer sounds like**

- "We'd randomly terminate instances in production." — describes a
  tool, skips every precondition, and is how a program gets banned
  after one incident.
- "We run chaos experiments in staging." — safe, comfortable, and the
  findings don't transfer because staging's traffic and dependencies
  aren't production's.
- "The point is to build confidence." — the point is to falsify
  beliefs; confidence is what you get if nothing was wrong, which is
  rarely the case.
- "We'd schedule a game day once a quarter." — cadence without
  preconditions, without an abort, and without a backlog for the
  findings is theatre with a calendar invite.

**Common wrong turns**

- **Acquiring injection tooling before observability.** The tool is
  the easy part to buy and the useless part without signals. Recover
  by running detection tests with no tooling at all first.
- **Making the abort a human procedure.** It works in the rehearsal
  and fails in the one that matters. Recover by making termination a
  property of the experiment definition.
- **Running region exercises separately from DR drills.** Two programs
  produce two sets of findings that eventually contradict. Recover by
  merging them and naming one owner.
- **Producing findings with no owner.** The report is written,
  circulated, and nothing changes. Recover by routing findings into
  the same backlog and review as any other reliability work.

**Follow-up probes the interviewer asks next**

1. **"Escalate this: an experiment causes a real customer-visible
   outage. What happens next?"** — the abort fires, the incident
   process runs exactly as it would for any other outage, and the
   program's continuation becomes a leadership decision made with the
   full record. I'd have agreed in advance what happens in this case,
   because deciding it during the post-incident review is when
   programs get cancelled for the wrong reasons.
2. **"A team refuses to participate. How do you handle it?"** — I'd
   start with their dependencies rather than their service, because
   the findings will reach them anyway and they'll be more
   comfortable joining a program that already found something real.
   Mandating participation early is how the program acquires enemies
   it can't afford.
3. **"What's the single most valuable experiment you'd run?"** — the
   control-plane one: degrade the deployment pipeline and the
   monitoring path, then ask teams to execute their recovery runbook.
   Almost every runbook has a hidden dependency on exactly those.
4. **"Who owns this program in two years?"** — the same reliability
   function that owns the error-budget policy, with experiments
   proposed by service teams. If it lives in a separate chaos team, it
   becomes something done *to* teams and the findings get contested
   rather than fixed.
5. **"How do you measure whether it's working?"** — falsified beliefs
   found per exercise, and time-to-detection trending down. If
   exercises stop finding anything, either the system matured or the
   experiments got too gentle, and I'd assume the second until shown
   otherwise.

**Cross-references**

- `D6-Q07` — the DR drills this program's top rung shares; run them as
  one exercise.
- `D6-Q04` for the observability precondition; `D6-Q05` for the
  budget-aware scheduling; `D6-Q15` for the control-plane rung's
  favourite finding.
- `03-comparisons/05-ha-dr-strategies.md` — per-tier testing and
  validation practice, which is what the region rung is exercising.

---

### D6-Q09 — "Traffic is forty times higher at peak than at trough, every single day. Design the capacity and autoscaling story."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 6.2, 2.3, 4.3 |
| **Axis** | operations |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D6-Q06` |

**What the interviewer is actually testing**

Whether you understand that a predictable swing and an unpredictable
spike are completely different problems. Forty times, every day, at
roughly the same hours, is a *schedule*, and treating it as a reactive
autoscaling problem means you pay the scale-up latency every morning
and the idle cost every night. The signal is whether you separate the
predictable part from the reactive part.

**Clarifying questions to ask before drawing anything**

- **Is the swing predictable in time, or just in magnitude?** A daily
  business-hours curve I can schedule against. A forty-times spike at
  an unknown hour is a different design and a much more expensive one.
- **What's the slowest thing in the scale-up path?** Instance boot,
  container pull, application warm-up, connection pool establishment,
  cache fill — the largest of those sets the minimum reaction time and
  therefore the size of the headroom I have to carry.
- **What's downstream, and can it take forty times the load?** The
  compute tier scaling beautifully into a database that can't is the
  most common version of this failure, and it turns a capacity problem
  into an outage.
- **Is the trough genuinely idle, or just low?** If it's truly near
  zero, scale-to-zero options change the economics entirely. If it's a
  low but non-zero floor, I'm sizing a baseline and the discount levers
  differ.
- **How bad is a few minutes of degradation at the start of peak?** If
  the answer is "unacceptable," I pre-warm and pay for it. If it's
  "noticeable but survivable," reactive scaling with good headroom is
  much cheaper.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| The swing is diurnal and repeatable | Stated | — | Makes scheduled capacity the primary lever, not the fallback |
| Peak must not degrade during ramp | Assumed | "I'll assume the morning ramp is customer-visible — tell me if a few slow minutes are fine, because that halves the cost" | Forces pre-warming ahead of the curve |
| Downstream data tier has its own limits | Assumed | "Compute scaling into a database that can't is the usual failure here" | Adds a downstream capacity check and a concurrency ceiling |
| Trough is low but not zero | Assumed | "If it's genuinely zero, scale-to-zero compute changes the whole answer" | Determines whether a committed baseline is worth it |
| Cost matters enough to engineer for | Assumed | "Otherwise the answer is 'run peak capacity all day' and we're done" | Justifies the complexity of a layered approach |

**The answer, out loud**

I'd split the capacity into three layers and manage each with a
different mechanism, because using one mechanism for all three is what
makes this expensive.

Layer one is the baseline: the capacity that is running at the trough
and never goes away. This is steady, predictable, and known a year in
advance, which makes it exactly the shape that committed use discounts
are for. I'd size the baseline at the trough level plus a margin and
commit to it, because that's the portion where a commitment carries no
risk of stranding capacity.

Layer two is the scheduled ramp, and this is the layer people miss. If
peak arrives at the same hour every day, I don't want the autoscaler
to discover it — I want capacity already there. So I'd use scheduled
scaling to raise the autoscaler's minimum ahead of the curve, sized to
the expected peak from the last few weeks of actual data. The
autoscaler still runs; I'm just moving its floor. The effect is that
the morning ramp is a non-event instead of a daily fifteen minutes of
elevated latency while instances boot and warm up.

Layer three is reactive autoscaling on top, and it exists for the part
I genuinely can't predict — a promotion, a news event, a retry storm
from a dependency. I'd scale on a signal that reflects the actual
constraint rather than on CPU by default. For a request-serving tier,
that's usually load-balancer requests per instance or a concurrency
metric; CPU is a proxy that lags and that misbehaves when the
bottleneck is a downstream wait rather than computation.

Two parameters matter more than the rest and I'd call them out. First,
scale-in must be much slower than scale-out. Scaling out aggressively
costs a little money; scaling in aggressively costs availability,
because a brief dip followed by recovery leaves you short. Asymmetric
behaviour here is not a tuning detail, it's the difference between a
stable system and one that oscillates. Second, the maximum instance
count is a deliberate blast-radius control, not just a cost guard —
it's what stops a retry storm from converting into forty times the
load on the database.

Which brings me to the downstream check, and I'd raise this
unprompted. Forty-times compute scaling is easy. The database usually
isn't elastic on that curve, and connection counts scale with instance
count rather than with useful work. So I'd put a connection pooling
layer in front of the data tier, cap per-instance pool size, and treat
the data tier's capacity as the real ceiling that the compute
maximum is derived from. If the data tier can't take peak, no amount
of compute autoscaling helps — it just moves the queue.

On compute selection, the swing shape itself is an argument. A
workload with this profile and a stateless request model is close to
the ideal case for a pay-per-use serverless runtime, where the trough
genuinely costs nothing and the ramp is the platform's problem rather
than mine; the tradeoff is less control over warm-up and a different
set of limits. If the workload needs VM-level control or has a real
baseline worth committing to, instance groups with the three-layer
approach win. I'd make that call against the compute matrix rather
than by preference, and I'd say which constraint decided it.

The last thing is that this design needs a feedback loop, not a
one-time tuning. The schedule should be regenerated from recent actual
traffic on a regular cadence, because the curve moves — seasonally, as
the product grows, as marketing changes. A scheduled scaling policy
authored once and never revisited is wrong within a quarter, and it
fails in the expensive direction as often as the risky one.

**Architecture**

```
  instances
     ▲
 40x │              ┌───────────── reactive headroom ──────┐  ◄── (3)
     │          ┌───┘   scales on requests-per-instance,   │
     │          │       NOT CPU by default          ◄─(4)  │
     │  ┌───────┘                                          └──┐
     │  │        SCHEDULED FLOOR raised ahead of the curve ◄(2)│
     │  │        sized from the last few weeks of real data    │
  1x ├──┴──────────────────────────────────────────────────────┴──
     │           COMMITTED BASELINE — never goes away    ◄── (1)
     └────────────────────────────────────────────────────────► time
       trough        ramp              peak            trough

  ASYMMETRY — the two parameters that matter most          ◄── (5)
   scale-OUT fast (costs a little money)
   scale-IN  slow (scaling in fast costs availability)

  CEILING IS DERIVED, NOT CHOSEN                           ◄── (6)
  ┌──────────────────────────────────────────────────────────────┐
  │ max instances ← what the DATA TIER can absorb, not what the  │
  │ compute tier can launch                                      │
  │   · connection pooling in front of the data tier      ◄─(7)  │
  │   · per-instance pool cap so connections scale with useful   │
  │     work rather than with instance count                     │
  │   · max instances doubles as retry-storm blast control ◄(8)  │
  └──────────────────────────────────────────────────────────────┘

  FEEDBACK LOOP — the schedule is regenerated, not authored once
  ┌──────────────────────────────────────────────────────────────┐
  │ recent actual traffic → new schedule → observed ramp quality │◄(9)
  │ a schedule written once is wrong within a quarter            │
  └──────────────────────────────────────────────────────────────┘

  Cross-cutting: if the workload is stateless and the trough is
  genuinely near zero, a pay-per-use serverless runtime removes layers
  1 and 2 entirely — decide against the compute matrix, not by
  preference, and say which constraint decided it (10).
```

**Every arrow explained:**

1. **Committed baseline** — the trough capacity is known a year out,
   which is exactly the risk profile a commitment suits. Wrong
   alternative: committing to peak capacity, which strands most of it
   for most of the day.
2. **Scheduled floor ahead of the curve** — a predictable ramp should
   never be discovered by an autoscaler. This single change removes
   the daily morning latency bump.
3. **Reactive layer for the genuinely unpredictable** — promotions,
   news, retry storms. It sits on top of the schedule rather than
   replacing it.
4. **Scale on a constraint signal, not CPU** — CPU lags and misreads
   downstream waits. Requests or concurrency per instance reflects
   what's actually saturating.
5. **Asymmetric scale-out and scale-in** — symmetric settings make the
   system oscillate, and oscillation costs availability during exactly
   the dips that preceded recovery.
6. **Ceiling derived from the data tier** — compute that scales past
   what the data tier absorbs moves the queue rather than clearing it.
7. **Connection pooling with a per-instance cap** — otherwise
   connection count tracks instance count and the database exhausts
   before the compute tier is near its limit.
8. **Maximum instances as blast-radius control** — a retry storm
   otherwise converts directly into forty times the downstream load.
9. **Schedule regenerated from recent data** — the curve moves; a
   one-time schedule fails expensively as often as riskily.
10. **Serverless as a genuine alternative for the right shape** —
    removes two layers when the workload is stateless and the trough
    is near zero. Decided against the compute matrix, not by taste.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Predictable ramp handling | Scheduled floor ahead of the curve | Let the autoscaler react | Removes the daily ramp latency and the scale-up race entirely | When the peak time genuinely varies day to day — then reactive only, with more headroom carried as the price |
| Autoscaling signal | Requests or concurrency per instance | CPU utilisation | Reflects the actual saturating resource for a request-serving tier | When the workload really is CPU-bound compute — an encoding or simulation tier — then CPU is the honest signal |
| Baseline commitment | Commit to the trough level | Commit to the average, or commit to nothing | Zero stranding risk, and the trough is the only capacity that's certain | When the baseline itself is expected to shrink materially within the commitment term — then commit less and accept the higher rate |
| Instance ceiling | Derived from data-tier capacity | Set high, as a cost guard only | Prevents a retry storm from becoming a database outage | When the data tier genuinely scales with the compute tier — a horizontally partitioned store — then the ceiling is a cost decision again |
| Runtime choice | Instance groups with three layers | Pay-per-use serverless | Keeps VM-level control and lets the baseline be committed | When the workload is stateless and the trough is near zero — then serverless removes two layers of this design and most of its tuning |

**Making it concrete**

```hcl
# Three layers in one object: a committed baseline as min_replicas, a
# scheduled floor for the predictable ramp, and reactive scaling above.
resource "google_compute_region_autoscaler" "api" {
  name    = "api-autoscaler"
  project = "PROJECT_ID"
  region  = "REGION"
  target  = google_compute_region_instance_group_manager.api.id

  autoscaling_policy {
    min_replicas    = 10           # committed baseline, trough level
    max_replicas    = 400          # derived from data-tier capacity
    cooldown_period = 90           # scale-out reaction time

    load_balancing_utilization { target = 0.7 }

    scale_in_control {             # scale IN slowly, deliberately
      time_window_sec = 900
      max_scaled_in_replicas { percent = 10 }
    }

    scaling_schedules {
      name                  = "weekday-peak"
      min_required_replicas = 320   # floor raised BEFORE the ramp
      schedule              = "0 7 * * MON-FRI"
      duration_sec          = 43200
      time_zone             = "Etc/UTC"
    }
  }
}
```

The `scale_in_control` block and the `scaling_schedules` block are the
two that most teams never set, and they're the two that decide whether
this design is stable and affordable or merely configured.

**What a weak answer sounds like**

- "We'd use autoscaling." — names the mechanism and misses that a
  predictable curve shouldn't be discovered reactively every morning.
- "Scale on CPU above seventy percent." — a default that lags and that
  reads low when the real bottleneck is a downstream wait.
- "Set max instances high so we never run out." — converts a retry
  storm into a database outage; the ceiling is a control, not a limit
  you raise to be safe.
- "We'd run peak capacity all the time to be safe." — honest and
  expensive; the panel will ask what the trough costs and there's no
  defence beyond convenience.

**Common wrong turns**

- **Symmetric scale-out and scale-in settings.** The system
  oscillates, and it's short exactly when recovering from a dip.
  Recover by making scale-in deliberately slow and saying why.
- **Ignoring the data tier.** Compute scales perfectly and the queue
  moves one layer down. Recover by deriving the compute ceiling from
  the data tier's capacity out loud.
- **Authoring the schedule once.** It's wrong within a quarter and
  nobody notices because the autoscaler compensates expensively.
  Recover by making schedule regeneration a recurring job with a
  review.
- **Treating warm-up time as negligible.** Boot plus image pull plus
  cache fill is usually minutes, not seconds. Recover by measuring it
  and sizing headroom against the measurement.

**Follow-up probes the interviewer asks next**

1. **"Peak arrives two hours early because of a marketing email. What
   happens?"** — the scheduled floor hasn't lifted yet, so the
   reactive layer carries it, and the ramp is visible in latency for a
   few minutes. That's the designed behaviour and I'd rather be honest
   about it than claim the schedule covers surprises. The fix if it
   recurs is to feed marketing's calendar into the schedule generator.
2. **"Escalate this: a dependency starts failing and clients retry.
   Walk me through what your design does."** — request rate rises,
   autoscaling scales out toward the ceiling, and the ceiling stops it
   before the data tier is overwhelmed. Without the derived ceiling,
   the compute tier would faithfully amplify the retry storm into the
   database and turn a dependency problem into a full outage. I'd also
   want client-side backoff, because scaling to absorb retries is
   paying for load nobody asked for.
3. **"How do you size the scheduled floor?"** — from the recent
   observed peak with a margin, regenerated regularly. Sizing it from
   the all-time peak is how you pay for a one-off event every day for
   a year.
4. **"What's the cost story here, relatively?"** — the baseline is the
   cheapest capacity because it's committed; the scheduled layer is
   mid-cost and predictable; the reactive layer is the most expensive
   per unit and the smallest. Pushing capacity down that stack is the
   whole optimisation, and it's the same reasoning as `D6-Q12`.
5. **"Who owns the tuning in two years?"** — the service team, with
   the platform providing the schedule generator and the defaults. If
   the platform tunes forty services' autoscalers, it becomes a
   capacity-planning department and a bottleneck.
6. **"Does this change if the workload needs accelerators?"** — yes,
   substantially, and that's a different question: accelerator
   capacity has its own availability and scheduling constraints. See
   `D7-Q16` rather than assuming this design transfers.

**Cross-references**

- `03-comparisons/01-compute-options.md` — the cost-model shapes and
  discount levers per compute option; the serverless-versus-instance-
  group decision uses that matrix rather than restating it.
- `00-START-HERE/DECISION-TREES.md` Tree 1 for the compute selection
  itself.
- `D6-Q12` for the commitment strategy behind the baseline layer;
  `D7-Q16` for accelerator capacity, which does not follow this shape.

---

### D6-Q10 — "Your on-call rotation is burning out. Design the alerting and on-call architecture so that it reduces toil instead of moving it somewhere else."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 6.1, 4.3 |
| **Axis** | operations |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D6-Q04` |

**What the interviewer is actually testing**

Whether you can distinguish reducing work from relocating it. Adding a
triage team, a first-line rotation, or a "noise filter" moves pages to
someone else and calls it an improvement. The strong answer attacks the
supply of alerts, not the routing of them, and knows which alerts
should simply be deleted.

**Clarifying questions to ask before drawing anything**

- **How many pages per shift, and what fraction lead to an action?**
  That ratio is the diagnosis. If most pages lead to no action, this
  is an alert-quality problem, not a staffing problem.
- **Who currently gets paged for a service they don't own?** A
  platform or infrastructure rotation absorbing product-service pages
  is the clearest form of relocated toil.
- **What fraction of pages happen outside business hours?** If the
  answer is "proportional to traffic," fine. If it's concentrated at
  night, something batch-shaped is generating them and can probably be
  rescheduled.
- **Are there alerts nobody has acted on in months?** Those are the
  first deletions, and there are always more than people expect.
- **Does the rotation have time allocated to fix what pages them?** If
  on-call is fully consumed by responding, the backlog of causes never
  shrinks and the rotation gets worse every quarter.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Teams are on call for what they own | Assumed | "I'd resist a central rotation absorbing product pages — that's relocation, not reduction" | Routing derives from ownership metadata |
| Most current alerts are not actionable | Assumed | "Almost always true in a burnt-out rotation; I'd measure before assuming" | Deletion is the first and largest lever |
| Paging is reserved for customer impact | Assumed | "Resource-threshold alerts go to a queue, not a phone" | Splits the notification channels by severity |
| On-call has time to fix causes | Assumed | "If the rotation is fully consumed responding, nothing improves" | Allocates a share of on-call time to the backlog |
| Runbooks exist and are linked from alerts | Assumed | "An alert with no runbook is a puzzle handed to someone at 3am" | Makes the runbook link an alert-policy requirement |

**The answer, out loud**

I'd start by saying the goal is fewer pages, not faster handling of
the same pages, and that the levers are in a specific order because
each one makes the next cheaper.

Lever one is deletion, and it's the biggest. I'd pull every alerting
policy and join it against its firing history and whether anyone took
an action. Every alert that has fired repeatedly with no action is
deleted — not tuned, not routed to a lower-priority channel, deleted.
In a rotation that's burning out, this is usually a large fraction of
the alerts and it costs nothing but the nerve to do it. The objection
is always "but what if that one matters someday," and the answer is
that an alert everyone has learned to ignore provides no protection
anyway, so deleting it loses nothing real and recovers attention.

Lever two is symptom-based alerting. Most of what remains is
cause-based: disk filling, CPU high, a queue growing, a node
unhealthy. Those are proxies. The customer doesn't experience CPU;
they experience errors and latency. So the default alert set becomes
the SLO burn-rate pair from `D6-Q04` — fast burn pages, slow burn
files a ticket — and cause-based signals become dashboard context that
a responder looks at *after* being paged, rather than things that page
independently. This collapses the count dramatically, because one
service with fifteen resource alerts becomes one service with two SLO
alerts and a dashboard.

Lever three is routing derived from ownership rather than from a
table. The service manifest already names the owning group; the alert
policy's notification channel is generated from it. That means a reorg
updates routing automatically, and it means no alert can exist without
an owner — which is itself a useful constraint, because ownerless
alerts are how the platform rotation ends up carrying product
failures.

Lever four is the auto-remediation question, and I'd be careful here
because it's where toil gets hidden rather than removed. If a page's
correct response is always the same action, that action should be
automated and the page should disappear entirely — not be automated
*and* still page to confirm. An instance failing a health check should
be replaced by the instance group, silently, and only page if the
replacement rate is abnormal. A bad release should roll back
automatically (`D6-Q06`). The rule I'd apply is that automation which
still pages is not automation, it's a notification with extra steps.

Lever five is the part that makes it stick: the rotation needs
allocated time to fix causes, and the post-incident work has to
actually land in the backlog with an owner. If on-call is a pure
response function, the alert supply never shrinks and every quarter
is worse. I'd allocate a fixed share of the on-call engineer's time to
that backlog explicitly, and I'd track the trend in pages per shift as
the program's headline number.

Two things I would not do. I would not create a first-line triage team
that receives everything and escalates. That's relocation — the pages
still exist, someone still loses sleep, and the people who could fix
the causes are now insulated from the pain that motivates fixing them.
And I would not route low-severity alerts to a chat channel and call
it solved; a channel with a hundred daily messages is an ignored
channel, which is deletion with extra infrastructure.

The one exception where a central rotation is right is for platform
services themselves, where the platform team genuinely owns the
failure. That's `D6-Q15`, and it's a different situation from a
central rotation absorbing forty teams' product alerts.

**Architecture**

```
  DIAGNOSIS FIRST — pages per shift, and the fraction that led to
  any action at all. That ratio decides whether this is an alert
  problem or a staffing problem.                            ◄── (1)

  LEVER 1 — DELETE                                          ◄── (2)
  ┌──────────────────────────────────────────────────────────────┐
  │ every policy joined against firing history + action taken    │
  │ fired repeatedly, no action ever → DELETE (not tune, not     │
  │ downgrade). An ignored alert protects nothing.               │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  LEVER 2 — SYMPTOM, NOT CAUSE                               ◄── (3)
  ┌──────────────────────────────────────────────────────────────┐
  │ DEFAULT SET:  fast burn → PAGE   ·   slow burn → TICKET      │
  │ cause signals (CPU, disk, queue depth, node health) become   │
  │ DASHBOARD CONTEXT consulted after a page — they do not page  │
  │ independently                                         ◄─(4)  │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  LEVER 3 — ROUTING DERIVED FROM OWNERSHIP                   ◄── (5)
  ┌──────────────────────────────────────────────────────────────┐
  │ manifest owner-group → notification channel, generated       │
  │ consequence: no alert can exist without an owner      ◄─(6)  │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  LEVER 4 — AUTOMATE THE ALWAYS-SAME RESPONSE                ◄── (7)
  ┌──────────────────────────────────────────────────────────────┐
  │ health-check failure → instance replaced silently            │
  │ bad release       → automatic rollback (D6-Q06)              │
  │ page only on ABNORMAL RATE of the automated action     ◄(8)  │
  │ RULE: automation that still pages is a notification with     │
  │ extra steps, not automation                                  │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  LEVER 5 — ALLOCATED TIME TO FIX CAUSES                     ◄── (9)
  ┌──────────────────────────────────────────────────────────────┐
  │ fixed share of on-call time on the cause backlog; headline   │
  │ metric = pages per shift, trending                           │
  └──────────────────────────────────────────────────────────────┘

  EXPLICITLY REJECTED: a first-line triage rotation that receives
  everything and escalates — pages still exist, sleep is still lost,
  and the people who could fix causes are insulated from them (10).
```

**Every arrow explained:**

1. **Diagnose with the action ratio** — pages that led to no action
   are the measurable definition of noise, and the ratio decides which
   problem you're solving.
2. **Deletion first** — the largest single lever and the cheapest. An
   alert the rotation has learned to ignore provides no protection, so
   deleting it loses nothing.
3. **Symptom-based default set** — the burn-rate pair from `D6-Q04`.
   One service's fifteen resource alerts collapse into two.
4. **Cause signals as context, not pages** — they're what you look at
   after being paged, which is where they were always most useful.
5. **Routing generated from the manifest's owner group** — a reorg
   updates routing without anyone maintaining a table.
6. **No ownerless alerts** — the structural reason the platform
   rotation stops absorbing product failures.
7. **Automate the always-same response** — if the human decision is
   deterministic, it isn't a decision.
8. **Page on abnormal rate of the automated action** — one instance
   replacing itself is normal; twenty an hour is a signal.
9. **Allocated time on the cause backlog** — without it the supply of
   alerts never shrinks and the rotation degrades every quarter.
10. **First-line triage rejected** — it relocates the toil and removes
    the feedback pressure that would have fixed it.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| First action | Delete non-actionable alerts | Tune thresholds on all of them | Tuning preserves the count; deletion is the only thing that reduces it | When the alert is genuinely valuable and merely badly tuned — a small minority, and worth identifying explicitly |
| Alert basis | SLO burn rate (symptom) | Resource thresholds (cause) | Customers feel errors and latency, not CPU | When a resource genuinely predicts an unrecoverable failure with lead time — disk filling on a stateful node — then alert on the cause, deliberately |
| Rotation model | Team owns what it built | Central first-line triage that escalates | Keeps the feedback pressure on the people who can remove the cause | When a genuinely 24/7 service has a team in one timezone — then follow-the-sun coverage, with the owning team still receiving the findings |
| Automation policy | Automate and stop paging | Automate but still notify to confirm | A notification nobody acts on is the definition of the noise you're removing | When the automated action is new and unproven — then notify for a defined trial period with an end date, not indefinitely |
| Low-severity handling | Ticket queue with an owner | Chat channel | A channel with a hundred daily messages is deletion with extra infrastructure | When the team genuinely triages the channel as a practice — rare, and it decays without a named owner |

**What a weak answer sounds like**

- "We'd add a first-line support rotation." — moves the pages, keeps
  the pages, and insulates the people who could remove them.
- "We'd tune the thresholds." — preserves the alert count, which is
  the thing that's actually hurting.
- "We'd route low-priority alerts to a chat channel." — an ignored
  channel is a deleted alert with running costs.
- "On-call is just part of the job." — describes a culture, not a
  design, and the panel is asking for the design.

**Common wrong turns**

- **Improving routing before reducing supply.** Smarter routing of the
  same volume feels like progress and changes nothing. Recover by
  measuring the action ratio and deleting first.
- **Automating with a confirmation page.** The automation exists and
  the sleep loss doesn't change. Recover by removing the page and
  alerting on the rate instead.
- **Leaving post-incident actions unowned.** The cause list grows and
  nothing lands. Recover by putting the items in the same backlog and
  review as feature work.
- **Letting the platform rotation absorb unowned alerts.** It's kind,
  it's fast, and it permanently removes the pressure that would have
  fixed the alert. Recover by refusing ownerless alerts structurally.

**Follow-up probes the interviewer asks next**

1. **"You deleted an alert and three months later it would have caught
   something. How do you defend that?"** — I'd note that the alert had
   been firing without action for months beforehand, so it would
   almost certainly have been ignored again. The honest response isn't
   to restore it; it's to build a symptom-level alert that would have
   caught the customer impact regardless of cause.
2. **"Escalate: a dependency your forty services share degrades and
   every team pages at once. What's the design response?"** — that's
   correlated, not forty independent incidents, and the alerting
   architecture should recognise it: a platform-level signal fires,
   dependent services' pages are suppressed for a bounded window, and
   the platform incident becomes the single thread. Without that, the
   rotation's worst nights are the ones where the cause was never
   theirs (`D6-Q15`).
3. **"How do you keep this from regressing?"** — pages per shift as a
   published trend, reviewed with the same seriousness as an SLO. New
   alerts require an owner, a runbook link, and a stated action; those
   three requirements stop most of the regrowth on their own.
4. **"Who owns the alerting standards in two years?"** — the same
   reliability function that owns the error-budget policy, with teams
   owning their own service's set. Standards owned by nobody drift
   back toward alert-on-everything after the first incident someone
   feels was missed.
5. **"What's the one metric you'd put in front of leadership?"** —
   pages outside business hours per engineer per month. It's the one
   that correlates with attrition, and it makes the argument in terms
   leadership acts on.
6. **"What if a team insists on keeping a noisy alert?"** — it's their
   rotation, so it's their call, and I'd make sure the cost is visible
   to them specifically in the per-team page counts. Mandating
   deletion of a team's own alert spends authority I'd rather keep for
   the floor items.

**Cross-references**

- `02-services/06-management-operations.md` — alerting policy
  condition types including absence-of-signal, and notification
  channel selection.
- `D6-Q04` for the two-alert default set this design standardises on;
  `D6-Q05` for the budget policy the burn-rate alerts feed.
- `D6-Q15` for platform-level correlated incidents and page
  suppression.

---

### D6-Q11 — "Your Dataflow jobs and batch compute cost more every month and nobody knows why. Build me the optimization loop."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 4.3, 6.2 |
| **Axis** | operations |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D6-Q09` |

**What the interviewer is actually testing**

Whether you can treat cost as a performance metric with a feedback
loop rather than as a monthly surprise. The specific signal is whether
you know where the money actually goes in a data-processing job —
which is usually not where people assume — and whether you'd attach
the measurement to the pipeline rather than to a quarterly review.

**Clarifying questions to ask before drawing anything**

- **Is the cost growth from more data, more jobs, or worse jobs?**
  Three completely different problems. Cost per unit of data processed
  separates them immediately, and almost nobody is tracking it.
- **Are these streaming or batch pipelines?** A streaming job's cost
  is dominated by standing capacity and its tuning is about
  utilisation. A batch job's cost is dominated by total work and its
  tuning is about efficiency and interruption tolerance.
- **Is there a deadline attached to each job?** A job that must finish
  by 6am has a different cheapest configuration than one that just has
  to finish today. Without stated deadlines I can't use the cheapest
  capacity.
- **Can these jobs tolerate interruption and restart?** That single
  property unlocks the largest discount lever available in batch
  compute, and it's an application-design question, not an
  infrastructure one.
- **Who sees the cost of a job today?** If it's a line in a monthly
  bill nobody maps back to a pipeline, the loop doesn't exist and
  that's the first thing to build.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Cost per job must be attributable | Assumed | "Otherwise the loop has no signal and we're guessing" | Labels on every job, flowing into the billing export |
| Jobs have stated completion deadlines | Assumed | "A job with no deadline is a job I can run on the cheapest capacity available" | Deadline is what licenses interruption-tolerant capacity |
| Some jobs are interruption-tolerant | Assumed | "I'd expect most batch to be, and most streaming not to be" | Splits the discount strategy in two |
| Pipeline code can be changed | Assumed | "If the job is a black box, tuning is limited to machine shape and that's a much smaller lever" | Determines whether the biggest levers are reachable |
| Data volume is growing independently | Stated | — | Makes cost per unit, not total cost, the metric that matters |

**The answer, out loud**

The first thing I'd build isn't an optimisation, it's the measurement,
because without it every improvement is anecdotal. Every job gets
labels identifying the pipeline, the owning team, and the business
purpose, and those labels flow into the billing export. That gives me
cost per job run. Then I'd divide by a volume measure the job already
emits — records processed, bytes read — and the resulting cost per
unit is the metric the whole loop runs on. Total cost rising while
cost per unit falls is a healthy, growing system; total cost rising
while cost per unit is flat or rising is the actual problem, and those
two look identical on a bill.

Then I'd go after the places the money actually is, and I'd order them
by leverage rather than by ease.

The biggest lever in a data pipeline is usually not the machine type —
it's how much data the job reads and shuffles. Filtering and
projecting early, before any expensive operation, removes work rather
than making work cheaper, and removing work is strictly better.
Similarly, a job that reads an entire partitioned dataset because
nobody applied a partition filter is paying for the whole history
every run. I'd look here first because these changes routinely dwarf
anything infrastructure-level.

The second lever is shuffle and skew. A batch job whose runtime is
dominated by one straggler worker is paying for a fleet that's mostly
idle while one key finishes. Skew shows up as a huge gap between
median and maximum worker duration, and it's worth checking before any
tuning, because tuning a skewed job just buys more idle workers.

The third lever is the execution shape: autoscaling bounds, machine
shape, and whether the job uses a streaming engine's own resource
management rather than fixed worker counts. For batch specifically,
the biggest infrastructure lever is interruption-tolerant capacity —
if the job checkpoints and restarts cleanly, running it on
preemptible-class capacity is a large discount, and the price is
occasional restarts that a deadline with slack can absorb. This is why
I ask about deadlines: a job due "sometime today" can use that
capacity and a job due at 6am sharp with no slack cannot.

The fourth lever is scheduling. Jobs that all start at the top of the
hour create a burst that provisions peak capacity for a fraction of
the day. Spreading them, and letting deadline-flexible jobs fill the
gaps, flattens the curve — the same argument as `D6-Q09` applied to
batch.

Then the loop itself, which is the part that makes this durable. Cost
per unit is a monitored metric with a per-pipeline baseline, and a
regression is an alert routed to the owning team, not a finding in a
quarterly review. I'd put a cost-delta check in the pipeline's own CI:
when a pipeline's code changes, run it against a fixed sample and
compare cost per unit against the previous version. A change that
doubles unit cost then shows up in code review, which is the only
place it's cheap to fix. Without that check, cost regressions are
discovered a month later by someone who wasn't involved.

One boundary I'd state explicitly: this is the loop for data and batch
compute. Accelerated AI workloads have a different cost structure —
their tuning levers, capacity constraints and utilisation economics
don't follow this shape — and I'd point at `D7-Q13` rather than
pretend one loop covers both.

**Architecture**

```
  MEASUREMENT FIRST — without this, every improvement is anecdotal
  ┌──────────────────────────────────────────────────────────────┐
  │ job labels (pipeline · team · purpose) → billing export      │◄(1)
  │ cost per run ÷ volume the job already emits                  │
  │   = COST PER UNIT ← the metric the whole loop runs on  ◄(2)  │
  │ total ↑ with unit ↓ = healthy growth                         │
  │ total ↑ with unit flat/↑ = the actual problem                │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  LEVERS, ORDERED BY LEVERAGE (not by ease)
  ┌──────────────────────────────────────────────────────────────┐
  │ L1  READ LESS      filter and project early; partition       │◄(3)
  │     filters. Removing work beats making work cheaper.        │
  │ L2  SHUFFLE/SKEW   median vs max worker duration. A straggler│◄(4)
  │     means a mostly-idle fleet waiting on one key.            │
  │ L3  EXECUTION      autoscaling bounds · machine shape ·      │◄(5)
  │     INTERRUPTION-TOLERANT CAPACITY for checkpointing batch   │
  │     — the largest infra lever, licensed by deadline slack ◄(6)│
  │ L4  SCHEDULING     stop starting everything on the hour;     │◄(7)
  │     let deadline-flexible jobs fill the gaps                 │
  └───────────────────────────┬──────────────────────────────────┘
                              ▼
  THE LOOP — what makes it durable rather than a one-off project
  ┌──────────────────────────────────────────────────────────────┐
  │ cost per unit is a MONITORED METRIC with a per-pipeline       │
  │ baseline; regression alerts the OWNING TEAM            ◄(8)  │
  │ CI cost-delta gate: run the changed pipeline against a fixed │
  │ sample, compare unit cost to the previous version      ◄(9)  │
  │ → a doubling shows up in code review, not next month's bill  │
  └──────────────────────────────────────────────────────────────┘

  BOUNDARY: accelerated AI workloads have a different cost structure
  and different levers — see D7-Q13, don't stretch this loop (10).
```

**Every arrow explained:**

1. **Labels into the billing export** — the join that makes per-job
   cost exist at all. Without it the loop has no input and every
   conversation is anecdotal.
2. **Cost per unit as the governing metric** — separates "we process
   more data" from "we process data worse," which look identical on a
   total-cost chart.
3. **Read less, first** — filtering and projecting early removes work.
   The most common single finding is a missing partition filter making
   every run pay for the entire history.
4. **Skew before tuning** — a straggler-dominated job responds to
   tuning by acquiring more idle workers. Check the median-to-max
   worker spread before touching configuration.
5. **Execution shape** — autoscaling bounds and machine shape matter,
   and they matter less than levers one and two, which is why they're
   third.
6. **Interruption-tolerant capacity for checkpointing batch** — the
   largest infrastructure discount available, unlocked by the
   application property and licensed by deadline slack.
7. **Scheduling spread** — everything starting on the hour provisions
   peak capacity for a fraction of the day; the same argument as
   `D6-Q09`.
8. **Regression alert to the owning team** — routed like any other
   alert, from the same ownership metadata, not surfaced in a
   quarterly review by someone uninvolved.
9. **CI cost-delta gate** — the only place a cost regression is cheap
   to fix is the code review that introduced it.
10. **Explicit boundary at accelerated AI workloads** — different cost
    structure, different levers, covered in `D7-Q13`.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Governing metric | Cost per unit of data processed | Total pipeline spend | Separates growth from regression, which total spend cannot | When the business constraint really is an absolute budget ceiling — then total spend is the metric and unit cost is the diagnostic |
| First optimisation | Read and shuffle less | Tune machine shape and worker counts | Removing work beats making work cheaper, usually by a wide margin | When the pipeline code is a vendor black box you can't change — then machine shape is the only lever you have |
| Batch capacity | Interruption-tolerant where the job checkpoints | Standard capacity everywhere | The largest infra-level discount, paid for with occasional restarts | When the job has a hard deadline with no slack, or can't checkpoint — then standard capacity, and say why explicitly |
| Regression detection | CI cost-delta gate against a fixed sample | Monthly cost review | Catches the regression in the review that introduced it | When pipelines change rarely and the sample run is expensive relative to the risk — then monitoring alone, with a tighter alert |
| Scheduling | Spread starts, let flexible jobs fill gaps | Everything at the top of the hour | Flattens the provisioning curve instead of buying peak for a fraction of the day | When jobs have genuine data dependencies forcing a fixed order — then the ordering wins and the cost is accepted |

**Making it concrete**

```bash
# Labels are what make per-pipeline cost exist in the billing export.
gcloud dataflow jobs run PIPELINE_NAME \
  --project=PROJECT_ID \
  --region=REGION \
  --gcs-location=gs://BUCKET_NAME/templates/PIPELINE_NAME \
  --additional-user-labels=pipeline=PIPELINE_NAME,team=TEAM_NAME,purpose=nightly-aggregate \
  --max-workers=50

# Skew check before any tuning: a large median-to-max spread in worker
# duration means one key is holding a mostly-idle fleet.
gcloud logging read \
  'resource.type="dataflow_step" AND jsonPayload.message:"worker duration"' \
  --project=PROJECT_ID --limit=100
```

The label flags are unglamorous and they are the precondition for
everything else here — a pipeline without them produces cost data
nobody can attribute, and an unattributable cost is one nobody owns.

**What a weak answer sounds like**

- "We'd use smaller machine types." — a third-order lever presented as
  the answer; the panel will ask what the job actually spends its time
  on.
- "We'd review the bill monthly." — detection a month after the cause,
  by someone who wasn't involved in it.
- "We'd move everything to preemptible capacity." — right lever,
  applied without asking whether the jobs checkpoint or whether their
  deadlines have slack.
- "Costs go up because data grows." — sometimes true and always
  unfalsifiable without cost per unit; it's the sentence that ends
  investigations prematurely.

**Common wrong turns**

- **Tuning before checking skew.** More workers waiting on one key
  costs more and finishes no sooner. Recover by comparing median and
  maximum worker duration first.
- **Optimising the job that's easiest to change.** Effort goes where
  it's comfortable rather than where the money is. Recover by ranking
  pipelines by total spend before choosing one.
- **Treating cost as a finance concern.** It lands in a review nobody
  attends. Recover by routing cost regressions through the same
  alerting and ownership path as reliability signals.
- **Stretching this loop over accelerated AI workloads.** Different
  economics, different constraints. Recover by naming the boundary and
  pointing at `D7-Q13`.

**Follow-up probes the interviewer asks next**

1. **"A team says their job can't tolerate interruption. How do you
   test that?"** — run it on interruption-tolerant capacity in
   non-prod and see. Usually the claim means "we've never tried," and
   occasionally it's true and the checkpointing work becomes a costed,
   scheduled improvement rather than an assertion.
2. **"Escalate: your cost-delta gate blocks a pipeline change that
   ships a critical fix. What happens?"** — it warns, it doesn't
   block, for exactly this reason. A cost gate that can stop an
   incident fix is a gate that will be disabled the first time it
   matters. The warning goes into the review with an owner and a
   follow-up, which preserves both the fix and the signal.
3. **"How do you make teams care?"** — show them cost per unit for
   their own pipelines next to their peers', through the showback
   model rather than a chargeback fight. Relative visibility does most
   of the work; `D1-Q09` owns that operating model.
4. **"What if the biggest cost is storage, not compute?"** — then the
   loop is the same and the levers change to lifecycle policy,
   partitioning and retention. I'd rather find that out from the unit
   metric than assume compute because it's the part we were looking at.
5. **"Who owns this in two years?"** — the data platform team owns the
   loop and the defaults; pipeline teams own their own unit cost. If
   one central team owns every pipeline's efficiency, it becomes a
   queue and the regressions outpace it.
6. **"What would you cut if you only had two weeks?"** — labels,
   cost-per-unit dashboards, and the top three pipelines by spend.
   That's enough to find the missing partition filter that usually
   pays for the whole exercise.

**Cross-references**

- `02-services/06-management-operations.md` — billing export and
  Recommender positioning; `D6-Q12` for the estate-wide version of
  the same loop.
- `03-comparisons/01-compute-options.md` — the discount-lever table
  behind the interruption-tolerant capacity choice.
- `D7-Q13` — AI workload cost-performance tuning, which this question
  deliberately does not cover.

---
