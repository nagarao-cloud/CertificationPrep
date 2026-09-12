# Design Interviews — Migration and Modernization

> Seventeen whiteboard questions on the *time* axis: can you get an
> organisation from where it actually is to where it should be, while
> it keeps running? Written for Staff and Principal Cloud Architect
> interviews in the 2026 market, not for exam prep. `design-01` owns
> the target state; this file owns the years between here and there —
> sequencing, coexistence, cutover, and rollback.

**How to use this file:** answer each question out loud before reading
past the clarifying-questions block, and time yourself — migration
answers fail by wandering, not by being wrong. The tradeoff table's
last column is the one panels actually probe. The 6 R's matrix, the
data-transfer mechanism matrix and the per-layer R's pattern live in
`03-comparisons/04-migration-strategies.md` and are deliberately not
restated here; what this file adds is the interview framing and the
multi-year portfolio view that file doesn't carry.

## Question index

| ID | Question | Band | Axis | Domain leaves |
|---|---|---|---|---|
| D5-Q01 | Three years, two datacenters, 900 applications — sequence it | Principal | time | 1.4, 1.1 |
| D5-Q02 | Which twenty applications go in wave one, and defending that list | Staff+ | time | 1.4, 5.1 |
| D5-Q03 | Monolith decomposition — where the boundaries go, and what makes one wrong | Staff+ | time | 1.4, 1.2 |
| D5-Q04 | Strangler-fig cutover for a system that cannot take downtime | Staff+ | time | 1.4, 2.1 |
| D5-Q05 | Eighteen months of coexistence — traffic, data and identity across the boundary | Staff+ | time | 1.4, 2.1, 3.1 |
| D5-Q06 | Oracle on-prem against a stated RPO, with a one-hour window | Staff | time | 1.4, 2.2 |
| D5-Q07 | Four petabytes, ninety days, one hard cutover date | Staff | time | 1.4, 2.2 |
| D5-Q08 | Hybrid connectivity for a 400-site dealer network, built out over 18 months | Staff+ | time | 2.1, 1.3 |
| D5-Q09 | GKE Enterprise fleet topology across on-prem, Google Cloud and a second cloud | Staff+ | time | 1.3, 2.1, 5.1 |
| D5-Q10 | Service-mesh boundaries — where a mesh earns its cost and where it's overhead | Staff+ | time | 2.1, 5.1 |
| D5-Q11 | An API layer in front of systems you are forbidden to modify | Staff | time | 1.4, 2.1 |
| D5-Q12 | Repurchase as SaaS or refactor in-house, for a core internal system | Principal | time | 1.1, 1.4 |
| D5-Q13 | The wave is at 40% traffic and failing. Walk me through the next hour | Staff+ | time | 5.1, 6.2 |
| D5-Q14 | Migrating a team, not an application — ownership, on-call, skills, incentives | Principal | time | 4.2, 5.1 |
| D5-Q15 | Multi-year modernization funded only in visible-value increments | Principal | time | 1.1, 1.5 |
| D5-Q16 | A deliberate lift-and-shift landing pattern, and its exit criteria | Staff+ | time | 1.4, 1.5 |
| D5-Q17 | The decision framework for when *not* to use Kubernetes in a migration | Staff | time | 1.3, 1.4 |

---

### D5-Q01 — "We have three years to get out of two datacenters. About nine hundred applications. Where do you start, and what's the shape of the plan?"

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 1.4, 1.1 |
| **Axis** | time |
| **Whiteboard time** | 45–60 min |
| **Reads well after** | `D1-Q01`, `D1-Q12` |

**What the interviewer is actually testing**

Whether you understand that a 900-application datacenter exit is a
throughput problem, not an architecture problem. The target state is
mostly a solved question by the time this conversation happens — what
nobody has solved is the order, the rate, and what happens in the
twenty-six months where both estates are live. A candidate who starts
drawing a landing zone here has answered a different question.

**Clarifying questions to ask before drawing anything**

- **What is the actual deadline, and what makes it hard?** A lease
  expiry is negotiable and expensive; a hardware support contract
  ending, or a colo provider exiting the market, is not. I plan
  backwards from whichever date genuinely cannot move, and I want to
  know which one that is before I commit to a rate.
- **Is nine hundred the count of applications, or of things in the
  configuration management database?** Those numbers differ by a
  factor I'd rather discover in week two than in month fourteen.
  Typically a large fraction of the inventory is already dead, and
  that fraction is the single biggest lever on whether three years is
  achievable.
- **Who can say "retire this"?** If no one can, every application
  migrates, and the plan is arithmetically impossible. The existence
  of a named decision-maker for retirement is a harder constraint than
  any technical one.
- **Is the target one cloud, or is this a diversification programme?**
  A single target lets me build one factory. Two targets means two of
  everything — tooling, skills, landing patterns — and I'd want that
  named as a deliberate, funded choice rather than discovered later.
- **How many people do I actually get, and for how long?** Three years
  of sustained migration throughput is a staffing question first. I'd
  rather know it's twenty people for three years than be told "as many
  as you need," which always means fewer.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Hard exit date on both datacenters | Stated | — | Makes rate, not elegance, the governing metric |
| A landing zone will exist before wave one | Assumed | "I'm assuming we build or already have the foundation from `D1-Q01`; if not, that's a prerequisite project and it eats the first quarter" | Waves cannot start against an ungoverned target |
| Some applications will be retired, not moved | Assumed | "I'd want a working assumption that 15–25% of the inventory never moves — and I'd want to test that number in the first eight weeks" | Retire is the only wave that costs nothing to run |
| Both estates run simultaneously for most of the programme | Assumed | "For roughly two of the three years we pay for both. That's the programme's largest single cost and it shrinks only when things finish" | Makes decommission a deliverable, not cleanup |
| Business change does not stop during the migration | Assumed | "Nobody freezes feature work for three years, so every wave migrates a moving target" | Forces short wave cycles and per-app freeze windows, not a programme-wide freeze |
| Dependency data is incomplete | Assumed | "Every inventory I've seen is wrong about dependencies; I plan for discovery to run continuously, not as a phase" | Discovery becomes a standing capability, not a gate |

**The answer, out loud**

The first thing I'd say is that I'm not going to give you an order of
nine hundred applications, because that list would be wrong by month
three and maintaining it would consume the programme. What I'd design
instead is a machine that produces waves, and then I'd tell you the
rate it has to run at and what feeds it.

The arithmetic sets the shape. Three years is roughly thirty months of
useful execution once you subtract the ramp at the front and the
reserve at the back. If nine hundred applications all had to move,
that's thirty a month sustained, every month, with no bad quarters.
That number is achievable but only with a factory, and it's the number
I'd put on the wall in week one — because the useful conversation with
leadership is about the rate, and the rate is what tells them whether
they're funding this seriously.

So the plan is three tracks running at different speeds. Track one is
readiness: the landing zone, hybrid connectivity, identity federation,
and the first landing patterns. This is `D1-Q01` and `D5-Q05`
territory and it is a prerequisite, not a wave. I'd give it a quarter
and I'd resist letting it grow, because a readiness track with no
migration pulling on it will happily consume a year.

Track two is discovery and triage, and it never stops. I'd stand up an
assessment capability — Migration Center for the inventory, sizing and
dependency discovery, plus whatever the existing configuration
management database and network flow data can contribute — and treat
its output as continuously refreshed rather than as a one-time survey.
Every application gets a classification against the 6 R's, and the
matrix in `03-comparisons/04-migration-strategies.md` is what that
classification runs against; I wouldn't re-derive it in the room.
What I'd add on top of that matrix is the portfolio view it doesn't
carry: at nine hundred applications, the distribution matters more
than any individual decision. If I'm classifying 60% of the estate as
refactor, I've designed a programme that will not finish, and the
correct response is to move most of that into rehost with a real
modernization trigger behind it — which is `D5-Q16`.

Track three is the wave factory. A wave is a fixed-length cycle,
ideally four weeks, that always contains the same stages: pick,
prepare, rehearse, cut, soak, decommission. The critical design
decision is that the wave boundary is a *dependency cluster*, not a
team and not an application. Applications that share a database, a
file share, or a synchronous call path move together or they don't
move at all, because the alternative is a cross-datacenter chatty
dependency with a WAN in the middle of it. I'd sequence clusters, not
apps.

The ordering rule I'd actually commit to has three tiers. First,
everything that can be retired, because it is pure throughput with no
risk and it makes every later number better. Second, the clusters that
unblock other clusters — usually shared platform services, an
authentication dependency, a file share everything mounts, a message
broker. These are unglamorous and they gate half the estate. Third,
everything else in order of decreasing risk-adjusted difficulty, which
in practice means the hardest dependency clusters go in the middle
third of the programme, never the last. The last six months are
reserved for the tail: the applications with no owner, the ones whose
vendor went out of business, the one that needs a hardware dongle. I'd
say explicitly that the tail always exists, it is always worse than
expected, and a plan that schedules its hardest work last has already
failed.

The last thing I'd put on the board is what "done" means, because
programmes like this routinely reach 85% and stop. Done is not
"migrated," it's "decommissioned" — hardware powered off, licences
cancelled, contracts terminated. I'd make decommission a stage inside
every wave with its own sign-off, and I'd report the metric as
racks retired rather than applications migrated, because the second
number moves when work starts and the first only moves when work
finishes.

**Architecture**

```
  CONTINUOUS TRACKS                        THE WAVE FACTORY (4-week cycle)
  ─────────────────                        ──────────────────────────────

  ┌──────────────────────┐
  │ TRACK 1 — READINESS  │  ◄── (1)
  │ landing zone (D1-Q01)│
  │ hybrid link (D5-Q05) │──── prerequisite, one quarter, time-boxed
  │ identity federation  │
  │ landing patterns     │
  └──────────┬───────────┘
             │ gates the first wave only
             ▼
  ┌──────────────────────┐        ┌──────────────────────────────┐
  │ TRACK 2 — DISCOVERY  │        │  PICK                        │
  │ Migration Center     │───────▶│  one dependency CLUSTER,     │
  │ inventory + sizing   │  ◄─(2) │  never a loose app list ◄─(5)│
  │ dependency mapping   │        └──────────────┬───────────────┘
  │ flow data + CMDB     │                       ▼
  │ (never stops)  ◄─(3) │        ┌──────────────────────────────┐
  └──────────┬───────────┘        │  PREPARE                     │
             │                    │  target built, data seeded,  │
             ▼                    │  runbook + rollback written  │
  ┌──────────────────────┐        └──────────────┬───────────────┘
  │  TRIAGE GATE         │                       ▼
  │  6 R's per app       │        ┌──────────────────────────────┐
  │  (03-comparisons/04) │        │  REHEARSE                    │
  │  + PORTFOLIO CHECK:  │        │  full cutover in non-prod,   │
  │  is the distribution │  ◄─(4) │  including the rollback ◄─(6)│
  │  survivable? ────────┼───┐    └──────────────┬───────────────┘
  └──────────┬───────────┘   │                   ▼
             │               │    ┌──────────────────────────────┐
             ▼               │    │  CUT                         │
  ┌──────────────────────┐   │    │  D5-Q04 / D5-Q13 mechanics   │
  │  ORDERING RULE       │   │    └──────────────┬───────────────┘
  │  1. retire first     │   │                   ▼
  │  2. unblocking       │   │    ┌──────────────────────────────┐
  │     clusters next    │   │    │  SOAK — agreed period at the │
  │  3. hardest in the   │   │    │  new stack before sign-off   │
  │     MIDDLE third     │   │    └──────────────┬───────────────┘
  │  4. tail reserved    │   │                   ▼
  │     for last 6 mo ◄──┼(7)│    ┌──────────────────────────────┐
  └──────────┬───────────┘   │    │  DECOMMISSION  ◄── (8)       │
             │               │    │  hardware off, licence ended,│
             └───────────────┘    │  contract terminated         │
              feeds back:         └──────────────┬───────────────┘
              actual cost/app                    │
              re-rates the plan                  ▼
                                   METRIC PUBLISHED: racks retired,
                                   not apps migrated  ◄── (9)
```

**Every arrow explained:**

1. **Readiness is a prerequisite, not a wave** — and it is time-boxed
   on purpose. The common wrong alternative is an open-ended
   foundation phase; with no wave pulling on it, it will absorb a year
   and produce a platform nobody has tested with a real workload.
2. **Migration Center as the inventory and sizing engine** — automated
   discovery, right-sizing guidance and dependency signal, rather than
   a spreadsheet maintained by hand. Wrong alternative: trusting the
   configuration management database alone, which records what someone
   intended to run, not what is running.
3. **Discovery never stops** — dependencies change while you migrate,
   and every wave's rehearsal finds ones the map missed. Treating
   discovery as a completed phase is how a wave takes down a system
   that wasn't in its scope.
4. **The portfolio check, not just the per-app triage** — the 6 R's
   matrix answers "which R for this app." The portfolio question is
   whether the *distribution* of R's is survivable at this headcount
   and this deadline. A refactor-heavy distribution is the single most
   common way a three-year plan becomes a six-year one.
5. **The wave unit is a dependency cluster** — anything sharing a
   database, a file share or a synchronous call path moves together.
   Wrong alternative: picking by team or by ease, which leaves
   chatty dependencies straddling a WAN for months.
6. **Rehearsal includes the rollback** — a rehearsal that only
   exercises the happy path has validated half of the plan, and the
   half it skipped is the one that runs under pressure.
7. **Hardest work in the middle third** — early enough that failure is
   recoverable, late enough that the factory is proven. The tail
   (no owner, dead vendor, hardware dependency) gets the reserve at
   the end, because it always exists and is always worse than the
   estimate.
8. **Decommission is a stage inside the wave** — with its own
   sign-off. If it's a cleanup task after the programme, it never
   happens, and the programme's largest cost is paying for both
   estates longer than planned.
9. **Publish racks retired, not applications migrated** — the second
   number moves when work starts, the first only when work finishes.
   The metric you publish is the behaviour you get.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Plan artifact | A wave factory with a stated rate | A sequenced list of 900 applications | The list is wrong by month three and maintaining it consumes the programme | When the estate is small enough (under about 50 apps) that the list *is* the plan and a factory is ceremony |
| Wave unit | Dependency cluster | Individual application, or team | Clusters keep chatty dependencies on one side of the WAN | When applications are genuinely standalone — true for most batch and reporting workloads, and worth confirming rather than assuming |
| Hardest work | Middle third of the programme | Last, after the factory is proven | Leaves recovery time; the tail already claims the end | When the hardest cluster is also the forcing function for the deadline — then it goes first and everything else is scheduled around it |
| Default R at portfolio scale | Rehost with a modernization trigger | Refactor where it's technically justified | A refactor-heavy distribution does not finish in three years at any realistic headcount | When the estate is small and the refactor candidates are few, so the aggregate schedule risk is bounded |
| Reported metric | Racks retired / systems decommissioned | Percentage of applications migrated | Only rewards finishing, and finishing is where these programmes fail | When leadership needs early momentum evidence and nothing has finished yet — then report both, and say which one is the real one |

**What a weak answer sounds like**

- "I'd start by assessing all nine hundred applications." — that is a
  year of assessment before anything moves, and the assessment will be
  stale by the time the last one is done. The panel is listening for
  whether you'd run discovery continuously alongside execution.
- "We'd lift and shift everything, it's the fastest." — fastest per
  application, and it ignores that a meaningful slice of the estate
  should never move at all. It also skips the question of what makes a
  rehost worth building on, which is `D5-Q16`.
- "We'd modernize as we migrate — refactor everything to cloud-native."
  — this is the answer that sounds most ambitious and finishes least
  often. At nine hundred applications it is not a schedule, it is an
  aspiration with a deadline attached.
- "We'd move the easy ones first to build momentum." — half right.
  Wave one is about proving the factory (`D5-Q02`), but an ordering
  rule that is *only* easiest-first leaves every blocking dependency
  for late and guarantees a stalled second year.

**Common wrong turns**

- **Drawing the target architecture.** It is the most comfortable
  thing on the board and it is not what was asked. Recover by saying
  "the target state is `D1-Q01` and I'll assume it; the hard part here
  is the order," and redraw as a process flow.
- **Promising a date per application.** It feels like rigour and it
  creates nine hundred commitments you will break. Recover by
  committing to a rate and a wave cadence, with dates firm one quarter
  out and indicative beyond that.
- **Treating retirement as someone else's job.** Without a named owner
  who can kill an application, the whole estate migrates and the
  arithmetic breaks. Recover by making the retirement decision-maker
  an explicit ask in the first week.
- **Letting the readiness track run open-ended.** Platform work
  expands to fill the time available when no wave is waiting on it.
  Recover by scheduling wave one against a fixed date and letting that
  date pull the foundation to completion.

**Follow-up probes the interviewer asks next**

1. **"What's your rate in month three versus month eighteen?"** —
   month three should be deliberately slow, maybe three or four
   applications, because the wave is a rehearsal of the factory
   itself. The rate has to reach roughly thirty a month by month nine
   and hold. If it hasn't by month twelve, the plan needs re-scoping
   with leadership rather than heroics.
2. **"One cluster turns out to be four hundred applications sharing a
   single database. Now what?"** — that cluster is its own programme
   and it is almost certainly the forcing function for the whole
   deadline. I'd pull it forward, and I'd attack the coupling first —
   decompose the shared database access into services (`D5-Q03`)
   before trying to move anything, because moving four hundred
   applications in one cut is not a plan.
3. **"Escalate this: what's the blast radius if the triage is
   systematically wrong?"** — if we over-classify as retire, we turn
   off something a business unit depends on, which is a visible
   incident and recoverable. If we systematically under-classify as
   refactor, we don't find out for eighteen months, and by then we've
   spent half the budget on a third of the estate with both
   datacenters still running. The second failure is quiet, far more
   expensive, and is why I'd re-audit the distribution quarterly
   rather than only the individual calls.
4. **"Who owns this programme, and what happens when that person
   leaves?"** — a named programme owner with a delegate who has been
   in every steering meeting. The organisational risk here is real:
   three years exceeds the average tenure of the role, and a
   programme whose plan lives in one person's head resets when they
   go. The wave factory and the written triage criteria exist partly
   so the plan survives a handover.
5. **"Leadership wants it in two years instead of three. What do you
   cut?"** — not the rehearsal stage and not the decommission stage,
   because those are what make it finish. I'd cut scope: more
   retirements, more retain-in-place with a documented second phase,
   and I'd negotiate a partial exit — one datacenter fully closed on
   time, the second reduced to a rump. I'd be explicit that "the same
   scope faster" is not available at this headcount.
6. **"What would make you tell the board this plan isn't working?"** —
   two consecutive quarters below the rate with no identified
   single cause, or a rehearsal failure rate above roughly a third,
   which says the factory is guessing. I'd rather deliver that message
   in month nine than month twenty-six, and I'd agree the trigger
   thresholds up front so it isn't a judgement call under pressure.

**Cross-references**

- `03-comparisons/04-migration-strategies.md` — the 6 R's matrix, the
  data-transfer mechanism matrix, and the per-layer R's pattern that
  the triage gate runs against. Not restated here.
- `D1-Q01` for the target landing zone this programme lands into;
  `D1-Q12` for the brownfield variant where the target org already
  exists and is ungoverned.
- `D5-Q02` for wave one's composition, `D5-Q05` for the coexistence
  period this plan spends most of its life in, `D5-Q15` for what
  happens when the funding arrives in increments.
- `01-domains/DOMAIN-1-designing-planning.md` §1.4 — the underlying
  migration-planning material.

---

### D5-Q02 — "Wave one is twenty applications. Which twenty, and how do you defend that list to a VP who thinks you've picked the easy ones?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.4, 5.1 |
| **Axis** | time |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D5-Q01` |

**What the interviewer is actually testing**

Whether you know what wave one is *for*. It is not for business value
and it is not for momentum theatre — it is for calibrating the factory
while failure is still cheap. The second half of the question is the
real one: can you defend a technically correct list to someone whose
objection is legitimate? The VP is not being obtuse. Twenty easy
applications genuinely do prove very little, and a candidate who
dismisses the objection has failed the question.

**Clarifying questions to ask before drawing anything**

- **What does the VP think wave one is for?** If they think it's the
  first twenty of nine hundred, we're arguing about the wrong thing. I
  want the shared premise on the table first: wave one exists to
  produce a cost-per-application number and a list of everything our
  runbook doesn't cover.
- **Do we have a non-production environment for these applications
  that actually resembles production?** If not, rehearsal isn't
  possible and wave one's composition changes — I'd prefer the
  applications where a rehearsal is genuinely available.
- **How many distinct application *shapes* does the estate have?** Not
  how many applications — how many patterns. Three-tier with a
  relational database, batch job with a file share, packaged vendor
  product, internal web app, message-driven service. Wave one should
  cover as many shapes as it can afford to.
- **Is anything in the estate about to force its own deadline?** A
  certificate expiring, a support contract ending, a hardware failure
  already happening. That application goes in wave one regardless of
  how it scores, because the alternative is an unplanned migration.
- **Who signs off that a migrated application is accepted?** If
  acceptance criteria are invented after the cutover, wave one
  produces an argument rather than a number.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Twenty applications in the first wave | Stated | — | Small enough to inspect every one by hand, large enough to produce a real variance number |
| Wave one's output is a rate, not a milestone | Assumed | "I'd want us agreed that what wave one delivers is a calibrated cost-per-app and a corrected runbook" | Changes selection from value-maximising to information-maximising |
| Every app in the wave has a living owner | Assumed | "Ownerless applications are wave-three work at the earliest — they need an archaeology step first" | Excludes the tail deliberately, and says so |
| At least one genuinely uncomfortable application | Assumed | "Otherwise the VP's objection is correct and the wave proves nothing" | Forces one real production system into the list |
| Rollback is available for every app in the wave | Stated by me | "I'd make this a hard entry criterion — nothing enters wave one that we cannot put back" | Keeps the calibration exercise cheap when it fails |
| Acceptance criteria written before cutover | Assumed | "Per application, agreed with its owner, before we touch anything" | Prevents the wave ending in a subjective argument |

**The answer, out loud**

I'd start by reframing, because I think the VP and I disagree about
what wave one is, not about which applications are in it.

Wave one's product is not twenty migrated applications. Its product is
two numbers and one document: the real cost per application in
engineering days, the variance across those twenty, and a runbook
corrected by contact with reality. Everything about the selection
follows from that. If I were optimising for business value, I'd pick
differently and I'd be wrong, because a wave one that delivers value
and teaches us nothing leaves us guessing about the other eight
hundred and eighty.

So the selection criteria, in order. First, a living owner who will
answer a message on cutover night — this excludes the whole tail, and
I'd say plainly that the ownerless applications are a separate problem
requiring an archaeology step, not a migration step. Second, a
rehearsable non-production environment, because a wave one without
rehearsals is a wave one that teaches us only about our luck. Third,
reversibility: I will not put anything in wave one that we cannot put
back inside its maintenance window, because the entire point is to
fail cheaply. Fourth, and this is the one that does the real work,
*shape coverage*. I want the twenty to span as many application
archetypes as possible — a three-tier app on a relational database, a
batch job chewing a file share, a packaged vendor product with a
support matrix, an internal web app with a home-grown authentication
integration, something message-driven. Each archetype I cover in wave
one is a landing pattern I can then template for the dozens of
applications behind it. Twenty applications of the same shape is one
data point repeated twenty times.

Fifth — and this is my answer to the VP — at least two of the twenty
have to be uncomfortable. Real production systems, with real users,
where a bad night is a visible incident. Not the hardest thing in the
estate, but not a development-only tool either. My reason is exactly
the VP's reason: a wave of harmless applications produces a
cost-per-application number that is optimistic in a way we can't
measure, and we will then plan the entire three years against it. The
expensive failure mode isn't a bad night in wave one; it's discovering
in month eighteen that our estimates were built on a sample that
excluded everything difficult.

The way I'd actually run the conversation with the VP is to concede
the real point first. They're right that an all-easy wave proves
nothing. What I'd push back on is the implied alternative, which is
usually "start with the important systems" — that inverts the risk in
exactly the wrong direction, because the factory is at its least
capable in month two and the blast radius is at its largest. So the
offer I'd make is specific: I'll take the two hardest applications
that still meet the reversibility criterion, I'll report the variance
publicly rather than the average, and if the variance is wide I'll
re-plan the programme rather than defend the original number. That
last commitment is what makes the list defensible — not the selection
logic, but the promise that wave one is allowed to change the plan.

One more thing I'd put on the board: the exit criteria for wave one
itself. Wave one is done when all twenty are accepted by their owners,
soaked for the agreed period, and the source systems are actually
decommissioned — not when the last cutover completes. If the wave ends
with twenty applications running in two places, we've learned the
migration half of the cost and none of the decommission half, and
decommission is where these programmes stall (`D5-Q01`).

**Architecture**

```
  SELECTION FUNNEL — 900 applications in, 20 out
  ───────────────────────────────────────────────

  ALL APPLICATIONS (~900)
        │
        ▼
  ┌───────────────────────────────────────────────┐
  │ FILTER 1 — living owner who answers at 2am    │  ◄── (1)
  │ removes the whole ownerless tail              │
  └───────────────────┬───────────────────────────┘
                      ▼
  ┌───────────────────────────────────────────────┐
  │ FILTER 2 — rehearsable non-prod exists        │  ◄── (2)
  └───────────────────┬───────────────────────────┘
                      ▼
  ┌───────────────────────────────────────────────┐
  │ FILTER 3 — reversible inside its window       │  ◄── (3)
  │ HARD entry criterion, no exceptions in wave 1 │
  └───────────────────┬───────────────────────────┘
                      ▼
              CANDIDATE POOL
                      │
        ┌─────────────┴──────────────┐
        ▼                            ▼
  ┌──────────────────────┐   ┌────────────────────────────┐
  │ SELECT FOR SHAPE     │   │ FORCED ENTRIES             │
  │ COVERAGE  ◄── (4)    │   │ anything with its own       │
  │ 3-tier + RDBMS       │   │ expiring deadline ◄── (6)   │
  │ batch + file share   │   └────────────┬───────────────┘
  │ packaged vendor app  │                │
  │ internal web app     │                │
  │ message-driven svc   │                │
  └──────────┬───────────┘                │
             │                            │
             ▼                            │
  ┌──────────────────────┐                │
  │ FORCE 2 UNCOMFORTABLE│  ◄── (5)       │
  │ real prod, real users│                │
  │ still reversible     │                │
  └──────────┬───────────┘                │
             └────────────┬───────────────┘
                          ▼
                  WAVE ONE — 20 apps
                          │
                          ▼
  ┌───────────────────────────────────────────────┐
  │ OUTPUT (the actual deliverable)               │
  │  a. cost per app, in engineering days         │
  │  b. VARIANCE across the twenty  ◄── (7)       │
  │  c. runbook corrected by contact with reality │
  │  d. one landing template per archetype        │
  └───────────────────┬───────────────────────────┘
                      ▼
  ┌───────────────────────────────────────────────┐
  │ WAVE ONE IS DONE WHEN SOURCES ARE OFF ◄── (8) │
  │ not when the last cutover completes           │
  └───────────────────┬───────────────────────────┘
                      ▼
         RE-PLAN AUTHORITY: wide variance re-rates
         the whole programme, publicly  ◄── (9)
```

**Every arrow explained:**

1. **Living-owner filter** — cutover night needs someone who can say
   "yes, that's expected." The ownerless applications are a different
   kind of work (archaeology, then a retire-or-migrate decision) and
   mixing them into wave one corrupts the cost number with
   investigation time that isn't representative.
2. **Rehearsability filter** — an application with no usable non-prod
   can only be migrated live. That's a valid thing to do later with a
   proven factory; in wave one it means the rehearsal stage silently
   doesn't happen, which is the stage generating most of the learning.
3. **Reversibility as a hard entry criterion** — wave one's purpose is
   to fail cheaply. An irreversible cutover in month two is the one
   scenario where a calibration exercise turns into an incident
   review, and it is entirely avoidable by selection.
4. **Shape coverage, not application count** — each archetype covered
   becomes a template for the dozens behind it. Wrong alternative:
   twenty instances of the same three-tier pattern, which produces one
   data point with a sample size of twenty and no templates.
5. **Two deliberately uncomfortable applications** — this is the
   answer to the VP, and it's a concession, not a rebuttal. Without
   them the cost number is optimistic in an unmeasurable way and the
   entire three-year plan inherits that error.
6. **Forced entries** — anything with its own expiring deadline
   (certificate, support contract, failing hardware) joins wave one
   regardless of score, because the alternative is an unplanned
   migration at a time nobody chose.
7. **Variance is the headline number, not the average** — the average
   tells you what a typical wave costs; the variance tells you whether
   you can plan at all. A wide spread means the estate is more
   heterogeneous than the triage believed.
8. **Done means sources decommissioned** — otherwise the wave measures
   only the migration half of the cost and skips the half where
   programmes stall.
9. **Re-plan authority agreed in advance** — wave one is permitted to
   change the programme plan. Committing to that up front is what
   makes the selection defensible; without it, wave one is theatre
   that confirms whatever was already promised.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Wave one's purpose | Calibration — produce a rate and a corrected runbook | Deliver business value early | Guessing the rate for 880 remaining apps is the larger risk | When leadership credibility is already spent and the programme will be cancelled without a visible win — then pick one valuable app and say openly you're buying time |
| Selection axis | Archetype coverage | Lowest effort first | Each archetype covered becomes a template; twenty of one shape teaches one thing | When the estate is genuinely homogeneous (a single platform, one framework) — then effort ordering is fine and coverage is trivially satisfied |
| Difficulty mix | Two uncomfortable applications included | All-low-risk first wave | An all-easy sample produces an optimistic estimate that silently poisons the whole plan | When the team has never done a cutover together at all — then wave zero is one trivial app, and wave one is this list |
| Ownerless applications | Excluded from wave one | Include them to prove the hard case | Their cost is archaeology, not migration, and it contaminates the calibration | When the tail is the majority of the estate — then archaeology *is* the programme and it needs its own calibration wave |
| Headline metric | Variance across the twenty | Average days per application | Variance tells you whether the plan is plannable; the average hides a bimodal estate | When the twenty are genuinely one archetype and variance is meaningless — report the average and say why |

**What a weak answer sounds like**

- "We'd pick the twenty lowest-risk applications." — the VP's
  objection lands and there's nowhere to go. It also produces an
  estimate nobody should plan against, which is worse than producing
  no estimate at all.
- "We'd start with the most business-critical system to show
  commitment." — that's the largest blast radius at the moment the
  factory is least capable. Commitment is demonstrated by finishing,
  not by risking the revenue system in month two.
- "The VP doesn't understand the technical constraints." — even when
  partly true, this ends the conversation. The panel is watching
  whether you can find the legitimate half of a stakeholder objection,
  and there is one here.
- "We'll decide wave one after the full assessment is complete." —
  that's six months of nothing moving, and the assessment gets better
  from doing a wave, not from more analysis.

**Common wrong turns**

- **Treating the VP's objection as a communication problem.** It's a
  substantive point about sampling bias. Recover by conceding it
  explicitly and changing the list, not the framing.
- **Optimising for a clean wave.** A wave one with no surprises has
  told you nothing you didn't already believe. Recover by
  deliberately including the archetypes you're least sure about.
- **Letting wave one run long.** It will expand if allowed, because
  every application is interesting the first time. Recover by
  time-boxing the wave and moving unfinished applications to wave two
  rather than extending.
- **Reporting the average.** It's the number people ask for and the
  least useful one. Recover by leading with the spread and the two
  outliers, and explaining what made them outliers.

**Follow-up probes the interviewer asks next**

1. **"Wave one takes three times as long as estimated. What do you
   tell leadership?"** — that the estimate was wrong and here is the
   corrected rate, with the specific causes named. Then I'd re-scope
   against the new rate immediately rather than promising to catch up,
   because catch-up plans in month three are how programmes arrive at
   month thirty still behind.
2. **"One of your two uncomfortable applications fails its cutover and
   you roll back. Was wave one a success?"** — yes, unambiguously, and
   I'd say so publicly. A clean rollback in wave one is the single
   most valuable outcome available, because it validates the one
   procedure everything else depends on. The failure mode would be a
   rollback that *didn't* work.
3. **"Escalate: what's the blast radius if wave one's number is wrong
   by a factor of two and nobody notices?"** — the whole programme is
   planned against it. Staffing, budget, the datacenter exit date and
   the contract negotiations all inherit the error, and it surfaces
   around month fifteen when re-planning is at its most expensive.
   That's why variance is the published number and why the re-plan
   authority is agreed before the wave starts.
4. **"How do you pick wave two?"** — from wave one's evidence, not
   from the original plan. Whichever archetypes came in cheapest and
   most repeatable get scaled in wave two; the archetype that surprised
   us gets a second, smaller calibration rather than volume.
5. **"A team refuses to put their application in wave one. How do you
   handle it?"** — I'd find out why, because the reason is usually
   information I don't have: an audit window, a release freeze, a key
   person leaving. If the reason is just discomfort, I'd escalate to
   the programme owner rather than negotiate one-to-one, because wave
   membership can't be an opt-in or the wave becomes a self-selected
   easy set — which is precisely the VP's objection arriving through a
   different door.
6. **"Would your answer change if the deadline were one year, not
   three?"** — the criteria stay, the size shrinks. At one year I'd
   run a five-application wave zero over two weeks purely to validate
   the runbook, then go straight to volume, and I'd accept a less
   calibrated estimate as the price of the schedule — while saying out
   loud that this is what I'm trading away.

**Cross-references**

- `D5-Q01` for the factory this wave calibrates and the ordering rule
  it sits inside; `D5-Q13` for what happens when a wave fails mid-ramp.
- `D5-Q16` for the landing pattern the archetype templates encode.
- `03-comparisons/04-migration-strategies.md` — the per-application R
  classification feeding the candidate pool.
- `01-domains/DOMAIN-5-managing-implementation.md` — the delivery and
  stakeholder-management material behind the VP conversation.

---
### D5-Q03 — "This is a twelve-year-old monolith with about two million lines in it. Break it up. Where do the service boundaries go, and how do you know when you've put one in the wrong place?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.4, 1.2 |
| **Axis** | time |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D5-Q01` |

**What the interviewer is actually testing**

Whether you find boundaries in the data and the change history, or
invent them from the code's package structure. Most decomposition
failures are not execution failures — they are boundary failures that
took eighteen months to become visible. The second half of the
question matters more than the first: a candidate who can name the
symptoms of a wrong boundary has almost certainly lived through one.

**Clarifying questions to ask before drawing anything**

- **What is actually wrong with it today?** "It's a monolith" is not a
  problem statement. Slow deploys, a team blocked on another team,
  scaling one component forcing you to scale all of them, a single
  failure taking everything down — each of those points at a different
  first cut, and two of them don't need decomposition at all.
- **Is the database shared inside the monolith, and how shared?** If
  every module reads every table, the boundaries are in the data and
  we'll find them there. If modules already own table groups, most of
  the design work is already done and we're mostly moving code.
- **How many teams work in it, and where do they collide?** The
  merge-conflict map and the "waiting on another team's release" map
  are two of the best boundary signals available, and they're free.
- **What's the deployment frequency now, and what does the business
  need it to be?** If nobody is asking to ship faster and the thing is
  stable, decomposition may be the wrong project entirely — and saying
  that is a legitimate answer.
- **Is there a migration deadline attached to this?** Decomposing
  during a datacenter exit is a different problem from decomposing a
  system that already runs in the cloud. Under a deadline I'd move it
  first and decompose second, and I'd want to know which situation
  we're in.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| The system stays live throughout | Assumed | "I'm assuming there's no window where we can stop taking traffic for a re-architecture" | Forces incremental extraction behind a façade (`D5-Q04`) |
| Shared relational database underneath | Assumed | "Twelve years old with a shared schema is the overwhelming default; tell me if the data is already partitioned" | Makes data ownership, not code structure, the first cut |
| Multiple teams contribute to the codebase | Assumed | "Otherwise the coordination argument for splitting mostly evaporates" | Change-coupling and collision data become boundary evidence |
| No big-bang rewrite is funded | Stated by me | "I'd refuse a rewrite at this size regardless of funding — the replacement never catches the original" | Every boundary must be extractable independently |
| Some modules will never be extracted | Assumed | "A permanently remaining core is a normal, successful outcome, not a failure" | Prevents a decomposition backlog nobody can finish |

**The answer, out loud**

I'd start by saying where I would *not* look for boundaries: the
package structure. Twelve years of a shared codebase produces a
package layout that reflects when things were written, not what
belongs together. The boundaries are somewhere else, and there are
three places I'd go looking, in priority order.

The first and strongest signal is transactional coupling in the data.
I'd map which tables are written together inside a single transaction,
because that set is, in practice, a consistency boundary I cannot cut
without introducing a distributed transaction. If orders and order
lines and inventory reservations all commit together, they are one
service until somebody does the much harder work of making that
consistency eventual on purpose. So my first pass is: cluster the
tables by transactional co-write, and those clusters are my candidate
services. This is the cut that is expensive to get wrong and almost
impossible to fix later, which is why it goes first.

The second signal is change coupling, and it's free. The version
control history tells me which files change in the same commit, over
and over, for years. If two modules always ship together, they are one
deployment unit whatever the code says, and splitting them buys
nothing but a network hop and a release coordination meeting.
Conversely, a module that has changed on its own cadence for three
years is telling me it already has a boundary and nobody drew it.

The third signal is organisational: where do teams collide, and who
waits on whom. This is the weakest of the three as a *design* input,
because org charts change, but it's the strongest as a *sequencing*
input. The first boundary I actually extract should be the one that
unblocks a team that is currently blocked, because that's what buys
the political room to do the next four.

Now, how I'd do it. I would not extract by technical layer. Pulling
out "the data access service" or "the notification layer" produces a
distributed monolith — every business operation now touches four
services synchronously and you have added latency and failure modes
without gaining independent deployability. The unit of extraction is a
business capability that owns its data.

And I'd extract in a specific order within each capability: reads
first, writes second. A read path can be extracted, run in parallel
against the monolith, compared for correctness, and rolled back by
flipping a route — none of that is true of writes. So the pattern is:
stand up the façade (`D5-Q04`), route the capability's reads to the
new service which still reads the monolith's tables, then move the
data ownership, then move the writes, then remove the monolith's
access to those tables. The step that actually completes the boundary
is the last one — revoking the monolith's direct table access. Until
that happens, you have two systems sharing a database, which is the
worst intermediate state available and the one most teams stall in for
years.

On the second half of the question — how do I know a boundary is
wrong. There are five symptoms and I'd watch for all of them. One:
a single user-facing operation requires a synchronous call across the
boundary in both directions. That's not a boundary, that's a seam
through the middle of a transaction. Two: the two sides have to be
deployed together, or in a specific order, to avoid breakage. Three:
the chattiness is per-item rather than per-request — the classic
version of this is a list endpoint that now makes one cross-service
call per row. Four: the new service needs to read the other side's
tables to do its job, and someone has quietly granted it access.
Five, and this is the organisational one: the boundary sits in the
middle of a team, so every change requires one person to modify two
services and two pipelines.

If I see one of those I'd investigate. If I see three, I'd merge the
services back and re-cut, and I'd say out loud that merging back is a
normal operation rather than an admission of failure — the cost of
carrying a wrong boundary for two years vastly exceeds the cost of
undoing it in month three.

The last thing I'd put on the board is the honest ending. A successful
decomposition of a two-million-line monolith does not end with zero
monolith. It ends with the four or five capabilities that needed
independence extracted, and a smaller core that nobody has a business
reason to touch. Planning for full elimination is how this becomes a
five-year programme with no defined finish line.

**Architecture**

```
  FINDING THE BOUNDARIES — three evidence sources, ranked
  ──────────────────────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────┐
  │ SIGNAL 1 (strongest) — TRANSACTIONAL CO-WRITE CLUSTERS      │
  │  which tables commit together inside one transaction?       │
  │  that set is a consistency boundary you cannot cut      ◄─(1)│
  └───────────────────────────┬─────────────────────────────────┘
                              │
  ┌───────────────────────────▼─────────────────────────────────┐
  │ SIGNAL 2 — CHANGE COUPLING from version control history     │
  │  files that always ship together are one deployment    ◄─(2)│
  │  unit whatever the package structure claims                 │
  └───────────────────────────┬─────────────────────────────────┘
                              │
  ┌───────────────────────────▼─────────────────────────────────┐
  │ SIGNAL 3 — ORG COLLISION MAP (sequencing input, not a       │
  │  design input) — extract first what unblocks someone   ◄─(3)│
  └───────────────────────────┬─────────────────────────────────┘
                              ▼
                    CANDIDATE CAPABILITY
                              │
  EXTRACTION SEQUENCE — per capability, reads before writes
  ────────────────────────────────────────────────────────

   step 1  façade in front of the monolith (D5-Q04)        ◄─ (4)
              │
   step 2  new service serves READS, still reading the
           monolith's tables — compare against monolith    ◄─ (5)
              │
   step 3  move DATA OWNERSHIP: new service's own store,
           monolith reads it through the service            ◄─ (6)
              │
   step 4  move WRITES — the irreversible step, one writer
           at a time, never dual-write (D5-Q04)             ◄─ (7)
              │
   step 5  REVOKE the monolith's direct table access —
           the boundary is not real until this happens      ◄─ (8)

  WRONG-BOUNDARY ALARMS — merge back if three of five fire   ◄─ (9)
   a. synchronous calls cross the boundary in BOTH directions
   b. the two sides must deploy together, or in a set order
   c. chattiness is per-item, not per-request
   d. one side needs to read the other's tables
   e. the boundary runs through the middle of one team
```

**Every arrow explained:**

1. **Transactional co-write clusters first** — the only boundary
   signal that is expensive and near-impossible to correct later.
   Cutting through a transaction means either a distributed
   transaction or a deliberate consistency change, and both are
   architecture decisions, not refactors.
2. **Change coupling from history** — free, objective, and covering
   years. Two modules that always ship together are one deployment
   unit; splitting them adds a network hop and a coordination meeting
   and removes nothing.
3. **Org collision map as a sequencing input only** — org charts
   change and boundaries shouldn't follow them, but "who is blocked
   today" correctly decides which boundary to extract *first*.
4. **Façade first** — nothing can be extracted incrementally without a
   routing layer in front. This is the mechanism from `D5-Q04` and it
   is a prerequisite, not a later optimisation.
5. **Reads extracted first, compared against the monolith** — a read
   path can run in parallel and be verified before it serves anyone.
   The wrong alternative is extracting writes first because "that's
   the real work," which discards the only cheap verification step
   available.
6. **Data ownership moves before writes** — the new service gets its
   own store and the monolith reads through the service. Skipping this
   leaves two systems on one schema, which is where decompositions
   stall for years.
7. **Writes are the irreversible step** — one writer at a time, per
   entity, flag-controlled. Dual-write is where teams get hurt; the
   mechanics and the rollback are in `D5-Q04`.
8. **Revoking the monolith's table access completes the boundary** —
   until then the encapsulation is a convention, and conventions decay
   under deadline pressure. This step is the definition of done.
9. **Five wrong-boundary alarms, merge back at three** — merging back
   is a normal operation. Carrying a wrong boundary for two years
   costs vastly more than undoing it in month three, and teams
   under-use this option because it feels like failure.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Boundary evidence | Transactional data clusters first | Code/package structure | Package layout reflects authorship history, not cohesion; data coupling is the expensive kind | When the codebase was built with explicit module boundaries and enforced them — rare at twelve years old, but it does happen and then the packages are real evidence |
| Extraction unit | Business capability owning its data | Technical layer (data access, notifications) | Layer extraction produces a distributed monolith: more latency, more failure modes, no independent deploy | When the "layer" is genuinely a shared utility with no business state — an outbound email sender, say — where a shared service is correct |
| Order within a capability | Reads, then ownership, then writes | Writes first, "the real work" | Reads are verifiable in parallel and reversible by routing; writes are neither | When the capability is write-dominant and read paths are trivial — then extract the write path with per-entity flags and accept a slower ramp |
| End state | A smaller permanent core plus 4–6 services | Full elimination of the monolith | Full elimination has no business justification for the parts nobody needs to change | When the monolith's runtime itself is the problem — an unsupported platform, an expiring licence — then elimination is the requirement and the deadline sets the scope |
| Wrong boundary found | Merge back and re-cut | Add integration to make it work | Integration hides the error and makes it permanent; the cost compounds | When the boundary is nearly right and the coupling is one specific call that can genuinely move to one side — fix the placement, not the topology |

**What a weak answer sounds like**

- "I'd split it by the existing modules — they're already separated in
  the code." — package structure is an artefact of who wrote what and
  when. This is the single most common way teams arrive at a
  distributed monolith.
- "Microservices for everything, one per bounded context." — naming
  the pattern isn't doing the analysis. The follow-up is always "how
  did you decide where a context ends," and there's nowhere to go.
- "We'd rewrite it properly on the new platform." — a two-million-line
  rewrite against a moving original. The original keeps shipping
  features and the replacement never catches it; this is the failure
  mode with the highest sunk cost of any on this list.
- "We'd extract the database access layer first so everything goes
  through one service." — this creates a single synchronous
  dependency for every operation in the system, with none of the
  independence that justified the work.

**Common wrong turns**

- **Designing all the boundaries before extracting any.** The first
  extraction teaches you more about the seams than any amount of
  diagramming. Recover by committing only to the first boundary and
  explicitly leaving the rest as hypotheses.
- **Leaving the shared schema in place.** Two services on one database
  is the intermediate state everyone reaches and few leave. Recover by
  treating "the monolith's table access is revoked" as the definition
  of done for each boundary.
- **Extracting the most interesting capability first.** It's usually
  the most coupled one. Recover by picking the boundary that unblocks
  a blocked team and is cheap to reverse.
- **Refusing to merge a bad boundary back.** It reads as an admission
  of failure, so people integrate around it instead. Recover by
  naming merge-back as an expected outcome at the start, before any
  ego is attached to a particular cut.

**Follow-up probes the interviewer asks next**

1. **"Two capabilities need the same data and both want to own it.
   Who wins?"** — whoever writes it owns it; the other reads a
   projection or subscribes to events. If both genuinely write it,
   that's evidence the boundary is in the wrong place and the two
   should be one service until someone can articulate why the
   consistency can be eventual.
2. **"You've extracted four services and latency went up 40%. What
   happened?"** — almost always per-item chattiness, alarm (c). A
   list operation that used to be one query is now N calls. The fix is
   batch interfaces and, where the read pattern is genuinely joined, a
   read projection owned by the caller — not a cache bolted on to hide
   it.
3. **"Escalate this: what's the blast radius if you cut through a
   transaction boundary and don't notice for a year?"** — you get
   silent data inconsistency that surfaces as customer-visible
   incorrectness, usually in reconciliation or billing, and the
   remediation is a data-repair project across a year of records. It
   is the worst outcome in this whole question, and it is why
   transactional co-write analysis is the first thing I do rather than
   something I validate later.
4. **"The team says they can't ship features while this is
   happening."** — then the plan is wrong. Extraction must be
   incremental enough that feature work continues in the monolith
   throughout; if a boundary requires a feature freeze, it's too big
   and I'd cut it smaller. A freeze is also how the business loses
   patience with modernization generally (`D5-Q15`).
5. **"Your org restructures and the team boundaries change. Does the
   architecture have to follow?"** — no, and this is the
   organisational trap. Boundaries drawn from data and change coupling
   survive reorgs; boundaries drawn from last year's org chart don't.
   What does have to follow is ownership assignment, which is a
   different and much cheaper thing to change.
6. **"When would you tell someone not to decompose this at all?"** —
   when the stated pain is scaling one component, which is often
   solvable by running more copies of the monolith; when deploys are
   slow because of test-suite time rather than coupling; or when the
   system is stable and nobody is asking to change it faster. Two of
   the three commonest justifications for decomposition have cheaper
   answers, and saying so is worth more than a clean diagram.

**Cross-references**

- `D5-Q04` for the façade and the write-cutover mechanics this
  question depends on; `D5-Q10` for whether the resulting service
  count justifies a mesh.
- `D5-Q17` for whether the extracted services belong on Kubernetes at
  all — often they don't.
- `03-comparisons/04-migration-strategies.md` — the refactor row and
  its Conway's Law note; this question is that row at full depth.
- `03-comparisons/02-storage-database-options.md` for where each
  extracted capability's data should land.

---

### D5-Q04 — "This order system takes a few hundred transactions a second and the business says it cannot be down. Strangler-fig it. Walk me through the cutover, step by step."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.4, 2.1 |
| **Axis** | time |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D5-Q03` |

**What the interviewer is actually testing**

Whether you can sequence a cutover where each step is individually
reversible until exactly one step, and whether you know which step
that is. Everyone can describe a strangler fig in the abstract. The
question is whether you'll identify the write-authority flip as the
irreversible moment and design the rest of the plan around making that
moment as small and as recoverable as possible.

**Clarifying questions to ask before drawing anything**

- **What does "cannot be down" actually mean — no downtime, or no
  lost orders?** Those are very different. A few seconds of rejected
  requests with client retry is often acceptable; a lost accepted
  order never is. The second framing lets me use a brief quiesce,
  which makes the whole plan dramatically simpler.
- **Is the operation idempotent, and is there a client-supplied
  identifier?** If orders carry a client reference I can deduplicate
  across the cutover and retries become safe. If not, adding one is
  the first piece of work and it happens before anything moves.
- **Can traffic be split by entity — customer, account, region?** If I
  can flip authority per customer rather than globally, my rollback
  unit shrinks from "the system" to "one customer," which changes the
  risk profile of every subsequent step.
- **What reads the order database besides the order system?** Reporting
  jobs, a warehouse feed, a finance extract. These are what breaks
  silently after the cutover, and they're never in the original scope.
- **What's the reconciliation source of truth?** After any partial
  cutover I need an independent way to prove no order was lost or
  duplicated. If one doesn't exist, building it is part of the plan.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| No lost or duplicated orders | Stated by me | "I'd restate 'cannot be down' as 'cannot lose an accepted order' and check that lands" | Permits a short quiesce; forbids dual-write |
| Client-supplied idempotency key | Assumed | "If orders don't carry one today, adding it is step zero and it gates everything else" | Makes retries and replay safe across the boundary |
| Traffic can be split by customer | Assumed | "If we can't segment, rollback granularity is the whole system and I'd want a much longer soak" | Determines rollback unit |
| Downstream consumers of the order data exist | Assumed | "There is always a finance extract nobody mentioned" | Adds a consumer-migration track parallel to the main cutover |
| Both stacks can run concurrently | Stated by me | "The old stack stays warm and funded through the soak — that cost is the price of the rollback" | Rules out scaling the legacy path to zero at cutover |
| Schema changes are expand-then-contract | Assumed | "Nothing in the migration window may make a change the old code can't read" | Keeps rollback available at every step |

**The answer, out loud**

The whole plan is built around one observation: every step except one
is reversible by changing a route or a flag, and the exception is the
moment write authority moves. So I'd design the sequence to push that
moment as late as possible, make it as small as possible, and make
sure that when it happens, it happens for one customer at a time.

Step one is the façade. Nothing else in this plan works without a
routing layer in front of the existing system, and it has to go in
while the old system is still serving 100% of traffic, so that
installing it is itself a low-risk change we can validate. That's
either an API management layer or a load balancer with routing rules,
depending on how much policy we need — the choice is `D5-Q11`. What
matters here is that from this point on, "which system serves this
request" is a configuration change, not a deployment.

Step two is shadow traffic. The façade duplicates a copy of live
requests to the new stack, which processes them and discards the
result — or better, writes them to a shadow store — and nothing it
does is visible to a client. Then I compare: same inputs, same
outputs? This is the cheapest correctness testing available on a real
production workload and it catches the class of bug that no test suite
finds, which is "the legacy system has behaviour nobody documented."
I'd expect the first week of shadow comparison to be almost entirely
about discovering undocumented behaviour, and I'd budget for that
rather than treating each divergence as a defect.

Step three is read traffic, and this is where real users first touch
the new stack. Start at 1%, and crucially the new stack is still
reading the *legacy* database at this point. I have not moved any
data. If reads are wrong, I roll the percentage back and nothing is
damaged. I'd ramp reads over days, not hours, watching error rate,
latency distribution — not the average — and the business metric that
would notice a subtle correctness problem.

Step four is the data. The new stack gets its own store and continuous
replication runs from the legacy database into it. The legacy database
is still authoritative. This step is invisible to traffic and can run
for as long as it needs to, and I'd let it run long enough to observe
replication lag under peak load, because peak is when the cutover
tolerance matters.

Step five is the write cutover, and I'd slow down here in the
interview because this is the question. Writes do not ramp like reads.
There is exactly one authoritative writer at any instant, per entity,
because two writers to two stores is how you get divergence that
reconciliation cannot repair. So the flip is per-customer: for
customer X, quiesce their in-flight writes briefly, confirm
replication has caught up for their data, flip the authority flag,
reverse the replication direction for that customer so the legacy
store still receives their writes, and resume. Sub-second per customer
if the entity partitioning is clean. The reverse replication is not
optional — it is the rollback, and if it isn't running, rolling back
a customer means losing whatever they did after the flip.

I want to be explicit about what I'm rejecting: dual-write, where the
application writes both stores on every request. It looks like the
safe option and it is the least safe one, because there is no
transaction spanning the two stores, so every failure between the two
writes leaves a divergence, and the divergences accumulate silently
until someone runs a comparison. I'd rather have one authority and a
replication stream I can measure.

Step six is the soak. Both stacks up, legacy receiving reverse
replication, a reconciliation job running continuously comparing
order counts and values across the boundary. I'd hold here for a
defined period — long enough to cover a month-end close if this
system feeds finance, because month-end is when the undiscovered
consumer surfaces.

Step seven is decommission, and only after the downstream consumers
have been migrated off the legacy database. Turning off reverse
replication is the real end of reversibility, and it should be an
explicit, dated decision with a named approver rather than a cleanup
task.

The rollback path, at every step: steps one through four are a flag or
route change with no data implications. Step five rolls back
per-customer by flipping authority back, which works precisely because
reverse replication has been keeping the legacy store current. Step
six rolls back the same way. After step seven there is no rollback,
which is why step seven has a date and a signature.

**Architecture**

```
  STRANGLER-FIG CUTOVER — steps 1-7, with the reversibility line
  ─────────────────────────────────────────────────────────────

  step 1   clients ──▶ FAÇADE ──▶ LEGACY (100%)                ◄─ (1)
           routing becomes CONFIG, not a deployment
              │
              ▼
  step 2   clients ──▶ FAÇADE ─┬─▶ LEGACY (100%, authoritative)
                               └─▶ NEW (shadow copy, result      ◄─ (2)
                                   discarded / compared offline)
              │
              ▼
  step 3   clients ──▶ FAÇADE ─┬─▶ LEGACY  (99% → 10% reads)
                               └─▶ NEW     (1% → 90% reads)      ◄─ (3)
                                     │
                                     └─ NEW still reads the
                                        LEGACY database. No data
                                        has moved yet.
              │
              ▼
  step 4   LEGACY DB ══ continuous replication ══▶ NEW DB        ◄─ (4)
           legacy still authoritative; invisible to traffic;
           run long enough to see replication lag at PEAK
              │
   ═══════════╪══════ REVERSIBILITY LINE ══════════════════════
              ▼
  step 5   PER-CUSTOMER WRITE AUTHORITY FLIP                     ◄─ (5)
            a. quiesce customer X's in-flight writes (sub-second)
            b. confirm replication caught up for X's data
            c. flip authority flag for X
            d. REVERSE replication for X: NEW DB ══▶ LEGACY DB   ◄─ (6)
            e. resume
           ONE authoritative writer per entity, always.
           NOT dual-write.                                       ◄─ (7)
              │
              ▼
  step 6   SOAK — both stacks live, reverse replication running,
           reconciliation job comparing counts + values          ◄─ (8)
           hold across a month-end close if finance consumes this
              │
              ▼
  step 7   DECOMMISSION — only after downstream consumers moved;
           turning OFF reverse replication ends rollback.
           Dated decision, named approver.                       ◄─ (9)

  ROLLBACK: steps 1-4 = flag/route change, no data implication.
            steps 5-6 = flip authority back per customer; works
            only because (6) kept the legacy store current.
            after step 7 = none. That is why it has a signature.
```

**Every arrow explained:**

1. **Façade installed while legacy serves 100%** — so that installing
   it is itself a validated, low-risk change. From here on, "which
   system serves this" is configuration. The wrong alternative is
   introducing the façade and the new backend in the same change,
   which conflates two failure sources.
2. **Shadow traffic with offline comparison** — the cheapest
   correctness test available against a real production workload, and
   the only one that finds undocumented legacy behaviour. Expect the
   first week to be discovery, not defect triage.
3. **Read ramp before any data moves** — the new stack reads the
   legacy database, so a wrong read is a routing rollback and nothing
   is damaged. Watch the latency distribution, not the average; the
   tail is where a missing index shows up.
4. **Replication established while legacy stays authoritative** —
   invisible to traffic, and run long enough to observe lag at peak,
   because peak lag is what sets the quiesce window in step 5.
5. **Per-customer write-authority flip** — the rollback unit becomes
   one customer rather than the system. This is the entire reason to
   insist on entity-partitionable traffic in the clarifying questions.
6. **Reverse replication armed before the flip** — this *is* the
   rollback. Flipping authority without it means rolling back loses
   everything written after the flip, which converts a reversible step
   into an irreversible one by omission.
7. **Explicitly not dual-write** — two writers to two stores with no
   transaction between them diverge on every partial failure, and the
   divergence is silent until someone reconciles. One authority plus a
   measurable replication stream is strictly better.
8. **Soak with continuous reconciliation** — counts and values
   compared across the boundary, held across a month-end close if
   finance consumes this data. Month-end is when the consumer nobody
   mentioned surfaces.
9. **Decommission is dated and signed** — turning off reverse
   replication ends reversibility. Treating it as cleanup is how teams
   discover they can't roll back at the moment they need to.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Write cutover | Single authority, flipped per entity | Dual-write to both stores | No cross-store transaction exists, so dual-write diverges silently on every partial failure | When both stores are behind one transactional boundary — genuinely rare, and if it's true, say why rather than assuming it |
| Rollback unit | One customer | The whole system | Shrinks blast radius and lets the ramp continue while one customer is investigated | When the entity partition is unclean and per-customer state leaks across boundaries — then flip globally with a much longer soak |
| Read ramp timing | Before data moves | After the new store is authoritative | Lets correctness be tested with a pure routing rollback and zero data risk | When the legacy database cannot take the extra read load at all — then move data first and accept a heavier rollback |
| Verification | Shadow comparison on live traffic | Test suite plus a load test | Only shadow traffic finds behaviour that was never specified | When the system is genuinely well-specified and low-volume — then shadowing costs more to build than it returns |
| Legacy stack during soak | Kept warm and funded | Scaled to zero immediately after cutover | A rollback into a cold stack is not a rollback | When the soak has completed and consumers are migrated — which is exactly step 7, and it should be a decision, not a drift |

**Making it concrete**

```hcl
# Traffic split lives in config, so a rollback is a variable change
# and not a deployment. Percentages here are the read ramp only —
# write authority is a per-entity flag, never a percentage.
resource "google_compute_region_backend_service" "orders_read" {
  name   = "bes-orders-read"
  region = "REGION"

  backend { group = "LEGACY_NEG_SELF_LINK" }
  backend { group = "NEW_NEG_SELF_LINK" }
}

# Write authority: an entity-keyed flag, evaluated per request.
# Values: "legacy" | "new". There is no "both".
variable "write_authority_default" {
  type    = string
  default = "legacy"
}
```

The thing worth saying out loud about this snippet is what is
deliberately missing: there is no percentage for writes, and no "both"
value for the authority flag. The plan's entire safety argument
collapses the moment either of those exists.

**What a weak answer sounds like**

- "We'd dual-write to both databases during the transition." — the
  most common wrong answer and the most expensive one. There's no
  transaction spanning the two stores, so every partial failure leaves
  a divergence nobody sees until reconciliation runs.
- "We'd do a big-bang cutover during a maintenance window." — for a
  system stated to have no downtime tolerance, this answers a
  different question. It also concentrates all the risk into the one
  hour when everyone is tired.
- "We'd ramp traffic from 0 to 100% over a weekend." — reads maybe;
  writes never. Ramping writes as a percentage means both stores are
  authoritative for different requests, which is dual-write wearing a
  different name.
- "Once we're at 100% we turn the old system off." — skips the
  downstream consumers and the soak. The finance extract still points
  at the legacy database and nobody finds out until month-end.

**Common wrong turns**

- **Introducing the façade and the new backend together.** Two
  changes, one blast radius, and no way to tell which one broke.
  Recover by shipping the façade in front of the legacy system alone
  and letting it bake.
- **Treating shadow divergences as defects.** Most early divergences
  are undocumented legacy behaviour, and "fixing" the new system to
  match may be wrong. Recover by triaging each divergence into
  intended-behaviour-change versus defect, with the business owner.
- **Ramping on the average latency.** The new stack looks fine at p50
  and is failing at p99 for the largest customers. Recover by picking
  the ramp cohort by size, not at random, and watching the tail.
- **Forgetting the reverse replication.** Everything else is designed
  for rollback and then the one step that needs it doesn't have it.
  Recover before the flip — afterwards it's not recoverable, only
  reconstructable.

**Follow-up probes the interviewer asks next**

1. **"You're at 60% of customers flipped and you find a data
   divergence. What now?"** — freeze the flip immediately, don't roll
   back yet. Determine whether the divergence affects flipped
   customers only (new stack bug, roll those back) or all customers
   (shared dependency, rollback doesn't help). That branch is the
   whole decision and it's the same one as `D5-Q13`.
2. **"The quiesce takes eight seconds instead of sub-second. Is the
   plan dead?"** — no, but the per-customer flip becomes a scheduled
   event rather than a continuous ramp, and the cause is almost always
   replication lag or long-running transactions on the legacy side. I'd
   fix the cause rather than accept eight seconds times thousands of
   customers.
3. **"Escalate this: what's the blast radius if the reconciliation job
   itself is wrong?"** — we believe we're consistent and we aren't, and
   we act on that belief by decommissioning the legacy store. That's
   the worst outcome in this design, so I'd want the reconciliation
   built by someone other than the team that built the write path, and
   I'd seed a known divergence deliberately to prove the job detects
   it before trusting it.
4. **"Who decides when to flip the next cohort, and at what hour?"** —
   the owning team, on a published schedule, in business hours with the
   legacy team available. Cutting over at 2am to "reduce impact" is
   exactly backwards for a per-customer flip: impact is already small,
   and what you want is people awake. That's an organisational call as
   much as a technical one and I'd defend it as such.
5. **"How long is the soak, and who gets to shorten it?"** — long
   enough to cover the slowest periodic consumer, which for anything
   touching finance means a month-end close. Nobody shortens it without
   the finance owner in the room, because the cost of being wrong lands
   on them and not on us.
6. **"What if the new stack is slower but correct?"** — then the ramp
   stops and this becomes a performance problem with the old system
   still serving, which is a comfortable place to be. I'd resist the
   instinct to push through on correctness grounds; a correct system
   that misses its latency budget is not yet a replacement.

**Cross-references**

- `D5-Q03` for how the capability being extracted was chosen;
  `D5-Q11` for choosing the façade technology.
- `D5-Q13` for the failure branch of this plan under live traffic.
- `D5-Q06` for the database-side replication and cutover mechanics
  underneath step 4 and step 5.
- `03-comparisons/04-migration-strategies.md` — the data-migration
  mechanism matrix; the continuous-replication row is what step 4 is.

---
### D5-Q05 — "For eighteen months, half this system is on-prem and half is in Google Cloud. Design the coexistence period."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.4, 2.1, 3.1 |
| **Axis** | time |
| **Whiteboard time** | 45–55 min |
| **Reads well after** | `D1-Q12`, `D5-Q01` |

**What the interviewer is actually testing**

Whether you treat coexistence as a designed state with its own
architecture and its own end date, or as an unfortunate gap between
two real architectures. Eighteen months is long enough that the hybrid
state becomes the production system — it will have incidents, it will
need on-call, it will accumulate workarounds — and a candidate who
hasn't planned for that will describe a target state and a start state
with nothing in between.

**Clarifying questions to ask before drawing anything**

- **Where does the front door live, and can it move first?** If I can
  put the public entry point in the cloud on day one and route
  backwards to on-prem, then every subsequent cutover is a routing
  change. If the front door has to move last, every cutover is a DNS
  change with a client cache in the way.
- **Is there one identity provider, or two?** Two means every
  cross-boundary call needs a credential translation, and I'd
  prioritise federation above almost everything else because it gates
  the rest.
- **What is the chattiest call path that will straddle the
  boundary?** That path sets the bandwidth and latency requirement for
  the hybrid link, and it's usually not the one people name first —
  it's a batch job or a shared file mount.
- **Does any data need to be writable on both sides simultaneously?**
  If someone says yes, I want to understand it precisely, because the
  honest answer is almost always "no, but two systems both write
  different parts of it," which is a solvable problem, whereas genuine
  bidirectional write is not.
- **What is the agreed end date for the hybrid link, and who owns it?**
  Without one, eighteen months becomes permanent. Hybrid connectivity
  built for a migration and never decommissioned is one of the most
  common findings in an estate five years later.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Roughly 18 months of simultaneous operation | Stated | — | Long enough that coexistence needs its own on-call and runbooks |
| One identity provider, federated early | Assumed | "I'm assuming we converge identity in the first quarter; if we can't, this design changes shape" | Gates every cross-boundary authorisation decision |
| The front door can move to the cloud early | Assumed | "I'd push hard for this — it converts later cutovers from DNS changes into routing changes" | Determines whether cutovers are minutes or TTL-bound |
| No data is authoritatively writable on both sides | Stated by me | "One authority per entity at all times — I'd make that a programme rule, not a per-app decision" | Forbids bidirectional replication anywhere |
| Landing zone exists and is governed | Assumed (from `D1-Q01`/`D1-Q12`) | "I'll assume the target hierarchy and Shared VPC are already there" | Coexistence hangs off the hub, not off ad-hoc projects |
| The hybrid link has a decommission date | Stated by me | "I'd put a date on the Interconnect contract deliberately" | Makes the temporary state visibly temporary |

**The answer, out loud**

I'd design this as three planes that each have their own rules, their
own migration order, and their own failure modes: traffic, data, and
identity. They interact, but designing them together is how people end
up with a bidirectional mess.

Identity goes first, and I'd say that unambiguously. Until there's one
identity provider and a working federation, every cross-boundary call
is either unauthenticated, or authenticated with a static secret
somebody pasted into a configuration file. Those static secrets will
outlive the migration by years. So: one provider, federated to Google
Cloud, with on-prem workload identities mapped to service accounts
through workload identity federation rather than by minting and
distributing service-account keys. That last point is the one I'd
defend hardest, because distributing keys to on-prem systems is the
easy answer and it produces a credential sprawl problem that nobody
cleans up. The landing zone's policy baseline already disallows
service-account key creation (`D1-Q01`); coexistence is exactly the
pressure that produces an exception request, and the answer to that
request is federation, not an exception.

Traffic is second and the key move is to relocate the front door
early. Put the public entry point — the global load balancer, the API
façade — in the cloud while every backend is still on-prem, with the
hybrid link carrying traffic backwards. This looks perverse for a
while and it is worth it, because from that moment every application
cutover is a backend routing change under my control, taking effect in
seconds, instead of a DNS change subject to resolver caches I don't
control. It also means the rollback for every cutover is the same
mechanism, which is worth more than any individual optimisation.

The link itself: HA VPN to get going, because it provisions in hours
and unblocks the first wave, and Dedicated or Partner Interconnect
behind it for the sustained period once the bandwidth profile is
understood — the matrix for that choice is in
`03-comparisons/03-networking-connectivity.md` and I wouldn't re-derive
it. What I'd add is the coexistence-specific part: this link is now a
production dependency for a system that never had a network dependency
before. Two applications that used to talk over a datacenter LAN now
talk over a WAN with a different latency distribution and an entirely
new failure mode. So before I split any chatty pair across the
boundary, I'd insist on timeouts, retries with backoff and
idempotency on that call path, and I'd rather move the pair together
(the dependency-cluster rule from `D5-Q01`) than instrument it.

DNS is the part people skip. Both directions need explicit
configuration: on-prem resolvers forwarding the cloud private zones,
and Cloud DNS forwarding the on-prem zones outbound. Configuring one
direction and assuming the other follows is a specific, common, and
very confusing outage.

Data is third and it has exactly one rule: one authority per entity,
always, and replication flows in one direction at a time. When an
application's data moves, the direction flips once — from on-prem-
authoritative with replication out to cloud, to cloud-authoritative
with replication back to on-prem for the rollback window, and then to
no replication at all when that window closes. I would not permit
bidirectional replication anywhere in the estate for the duration,
because the conflict-resolution semantics are unprovable in a system
this heterogeneous and the failure is silent.

The part I'd add that most answers miss: coexistence needs its own
operational model. There will be incidents in the hybrid state, and
the question "who gets paged when the link degrades" needs an answer
before it happens, not during. I'd want a single on-call rotation that
can see both sides — which means metrics and logs from on-prem flowing
into Cloud Monitoring and Cloud Logging early, so that the hybrid
period has one place to look. Two observability stacks during a
migration means every incident starts with twenty minutes of arguing
about which side is broken.

And the end date. I'd put a decommission date on the hybrid link in
the contract and the programme plan, owned by a named person, and I'd
report against it. The failure mode I'm designing against is the one
where eighteen months becomes five years, the Interconnect becomes
permanent infrastructure, and a handful of applications that were
supposed to move never do because the link makes not-moving
comfortable.

**Architecture**

```
  THREE PLANES, THREE DIFFERENT RULES — over three phases
  ──────────────────────────────────────────────────────

  PHASE A (months 0-3)      PHASE B (months 3-15)    PHASE C (15-18)
  ────────────────────      ─────────────────────    ───────────────

  IDENTITY PLANE — converges FIRST, gates everything else      ◄─ (1)
  ┌──────────────────┐     ┌──────────────────┐    ┌──────────────┐
  │ two IdPs, static │────▶│ ONE IdP, federated│──▶│ on-prem IdP  │
  │ secrets          │     │ workload identity │    │ retired      │
  │                  │     │ federation — NOT  │    │              │
  │                  │     │ SA keys      ◄─(2)│    │              │
  └──────────────────┘     └──────────────────┘    └──────────────┘

  TRAFFIC PLANE — front door moves EARLY, backends move later ◄─ (3)
  ┌──────────────────┐     ┌──────────────────┐    ┌──────────────┐
  │ clients          │     │ clients          │    │ clients      │
  │   ▼              │     │   ▼              │    │   ▼          │
  │ on-prem LB       │     │ CLOUD front door │    │ cloud front  │
  │   ▼              │     │   ├─▶ cloud app  │    │   ▼          │
  │ on-prem apps     │     │   └─▶ hybrid link│    │ cloud apps   │
  │                  │     │       ▼ on-prem  │    │ (link idle)  │
  │                  │     │   cutover = a    │    │              │
  │                  │     │   ROUTE change,  │    │              │
  │                  │     │   not DNS  ◄─(4) │    │              │
  └──────────────────┘     └──────────────────┘    └──────────────┘

  THE LINK — HA VPN for speed, Interconnect for the duration   ◄─ (5)
   ┌──────────────────────────────────────────────────────────┐
   │ HA VPN (hours to provision, unblocks wave 1)             │
   │   └─▶ Dedicated / Partner Interconnect once the          │
   │       bandwidth profile is known (03-comparisons/03)     │
   │ DNS forwarding BOTH directions, configured explicitly ◄─(6)│
   │ every straddling call path: timeout + backoff +          │
   │ idempotency, or move the pair together instead      ◄─(7) │
   │ DECOMMISSION DATE on the contract, named owner      ◄─(9) │
   └──────────────────────────────────────────────────────────┘

  DATA PLANE — one authority per entity, direction flips ONCE ◄─ (8)
   on-prem authoritative ──▶ cloud authoritative ──▶ no replication
      (replicate out)          (replicate BACK,        (rollback
                                rollback window)        window closed)
   bidirectional replication: not permitted anywhere, ever

  OPERATIONS — one on-call, one place to look
   on-prem metrics/logs into Cloud Monitoring + Cloud Logging from
   phase A, so an incident starts with evidence instead of an
   argument about which side is broken
```

**Every arrow explained:**

1. **Identity converges first** — every cross-boundary authorisation
   decision depends on it. Deferring it means static secrets in
   configuration files, and those outlive the migration by years.
2. **Workload identity federation, not service-account keys** — the
   easy answer is to mint keys and distribute them to on-prem systems;
   the result is credential sprawl nobody reclaims. The landing zone's
   policy baseline (`D1-Q01`) already forbids key creation, and
   coexistence is exactly the pressure that generates an exception
   request. Federation is the answer to that request.
3. **The front door moves early, backends late** — deliberately
   counter-intuitive. It converts every later cutover from a
   DNS change bound by resolver caches into a routing change under our
   control, and gives every cutover the same rollback mechanism.
4. **Cutover becomes a route change** — seconds to apply, seconds to
   reverse. The wrong alternative is per-application DNS cutovers,
   where rollback speed is set by whatever TTL clients actually honour.
5. **HA VPN first, Interconnect for the sustained period** — VPN
   provisions in hours and unblocks wave one; Interconnect takes weeks
   and is the right answer once the bandwidth profile is measured
   rather than guessed. Don't wait for Interconnect to start, and
   don't stay on VPN once sustained throughput is known.
6. **DNS forwarding in both directions, explicitly** — on-prem
   resolvers forwarding cloud private zones, and Cloud DNS forwarding
   on-prem zones. Configuring one and assuming the other follows is a
   specific and very confusing outage.
7. **Straddling call paths get timeouts, backoff and idempotency —
   or don't straddle at all** — a LAN call becoming a WAN call is a
   new failure mode for code that never had one. Preferred answer:
   move the dependency cluster together (`D5-Q01`) rather than
   hardening the call.
8. **One authority per entity, direction flips once** — on-prem
   authoritative, then cloud authoritative with replication back for
   the rollback window, then nothing. Bidirectional replication is
   forbidden for the duration because its conflict semantics are
   unprovable across a heterogeneous estate and the failure is silent.
9. **A decommission date on the link, with a named owner** — the
   failure mode is eighteen months becoming five years, with the
   hybrid link turning into permanent infrastructure that makes
   not-migrating comfortable.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Front door | Move to cloud first, route backwards | Move it last, after backends | Every later cutover becomes a route change with a fast, uniform rollback | When the front door carries appliance-based policy (a hardware device with no cloud equivalent) that genuinely cannot move yet — then move it last and accept DNS-bound cutovers |
| On-prem workload credentials | Workload identity federation | Service-account keys distributed to on-prem hosts | Keys sprawl, never get rotated, and survive the migration | When a legacy system genuinely cannot participate in federation — then a tightly scoped, short-lived, inventoried key, with an expiry date attached to the application's own migration date |
| Link technology | HA VPN now, Interconnect for the duration | Wait for Interconnect before starting | Weeks of provisioning would block wave one for no benefit | When the first wave is itself bandwidth-heavy (bulk data seeding) — then the transfer mechanism is `D5-Q07`'s question, not the link's |
| Replication direction | One direction at a time, flips once per entity | Bidirectional replication during coexistence | Conflict semantics across a heterogeneous estate are unprovable, and divergence is silent | When both sides are the same engine with a supported active-active mode and a real conflict policy — then it's a supported configuration, not a migration improvisation |
| Observability during coexistence | One pane: on-prem signals into Cloud Monitoring/Logging early | Keep both existing stacks and correlate manually | Every hybrid incident otherwise starts with twenty minutes of arguing about which side broke | When the on-prem estate is being switched off within weeks and the integration cost exceeds the remaining life of the signal |

**Making it concrete**

```hcl
# On-prem workloads authenticate by federation, not by key material.
resource "google_iam_workload_identity_pool" "onprem" {
  workload_identity_pool_id = "pool-onprem-migration"
}

resource "google_iam_workload_identity_pool_provider" "onprem_oidc" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.onprem.workload_identity_pool_id
  workload_identity_pool_provider_id = "prov-onprem-oidc"
  oidc { issuer_uri = "ISSUER_URI" }
}

# Deliberately absent from this file: any google_service_account_key.
# If one appears during coexistence, that is the finding, not the fix.
```

The comment at the bottom is the whole point. Coexistence is the
period during which an organisation accumulates the credentials it
spends the following three years trying to find, and the cheapest
moment to prevent that is before the first on-prem system needs to
call a cloud API.

**What a weak answer sounds like**

- "We'd set up a VPN and replicate data both ways." — bidirectional
  replication with no stated conflict policy. It works in the demo and
  produces silent divergence under partition, which is exactly when
  nobody is looking at replication.
- "Each application cuts over with a DNS change." — rollback speed is
  then whatever TTL clients actually honour, which is not what the TTL
  says. Moving the front door first removes this entire class of
  problem.
- "We'll generate service-account keys for the on-prem systems." —
  fast, easy, and the resulting credential sprawl outlives the
  migration. It also drives an exception against the landing zone's
  own baseline in the first month.
- "Coexistence is just a transition, we don't need to design it." —
  eighteen months is the production system. It will have incidents and
  it needs on-call, runbooks and observability like anything else.

**Common wrong turns**

- **Designing the hybrid link before knowing the chattiest path.**
  Bandwidth sizing built on the application people mention first,
  rather than the batch job that actually dominates. Recover by
  measuring flows before committing to a circuit size.
- **Configuring DNS forwarding in one direction.** It works for the
  first application and fails confusingly for the fourth. Recover by
  treating both directions as one piece of work with one test.
- **Letting the hybrid link become an architectural feature.** Once
  it's comfortable, applications get designed to use it. Recover by
  publishing the decommission date and refusing new dependencies on
  it after a stated cutoff.
- **Splitting a chatty pair across the boundary to hit a wave date.**
  The wave lands and the latency shows up a week later in the
  business metric. Recover by moving the cluster together even if it
  means a bigger wave.

**Follow-up probes the interviewer asks next**

1. **"The Interconnect goes down for four hours at month nine. What
   breaks?"** — everything straddling the boundary, which is why the
   dependency-cluster rule matters more than the redundancy design.
   With redundant circuits in separate edge availability domains plus
   the HA VPN retained as an encrypted failover path, we degrade
   rather than fail — but the honest answer is that some batch work
   will miss its window and I'd want that agreed in advance rather
   than discovered.
2. **"Escalate this: what's the blast radius if identity federation
   breaks?"** — far larger than the link failing, because it affects
   both sides at once and it looks like a mass authorisation failure
   rather than a connectivity failure. I'd want a documented,
   time-boxed break-glass path that does not involve creating a
   long-lived key under pressure — that decision made calmly in month
   one is worth more than any amount of runbook written in month nine.
3. **"Month twelve and only 40% has moved. Do you extend the hybrid
   period?"** — I'd extend it only with a re-scoped end date and a
   named list of what is now explicitly staying on-prem
   (retain, per `03-comparisons/04-migration-strategies.md`). An
   open-ended extension without that list is how the temporary state
   becomes permanent.
4. **"Who owns the hybrid link — the network team or the migration
   programme?"** — the programme owns the decommission date, the
   platform team owns the operation. Splitting it that way matters
   organisationally: if the network team owns it outright, they have
   no incentive to end it, and if the programme owns operations, it
   inherits a run function it will disband.
5. **"A team wants to build a new application that spans both sides.
   Yes or no?"** — no, after the cutoff date, and I'd make that a
   published rule rather than a per-request argument. New work builds
   in the target state; the hybrid link is for what already exists.
6. **"What's the first signal that coexistence is going badly?"** —
   the number of applications with a *new* cross-boundary dependency
   that didn't exist before. That number should be zero and it
   silently isn't, and it's the leading indicator of a hybrid state
   that has become the architecture.

**Cross-references**

- `D1-Q12` for the brownfield landing zone this period follows;
  `D1-Q01` for the hierarchy and the policy baseline it inherits.
- `03-comparisons/03-networking-connectivity.md` — the hybrid
  connectivity matrix and the hybrid DNS resolution patterns; not
  restated here.
- `D5-Q08` for the multi-site version of the link, `D5-Q06` for the
  data-plane cutover mechanics, `D5-Q04` for the per-application
  cutover the routing plane enables.
- `04-architectures/case-study-ehr-healthcare.md` — a migration-in-
  progress hybrid footprint with residency constraints layered on.

---

### D5-Q06 — "There's an Oracle database on-prem behind the core application. The business has stated an RPO of five minutes and will give you a one-hour maintenance window. Migrate it."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.4, 2.2 |
| **Axis** | time |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D5-Q04` |

**What the interviewer is actually testing**

Whether you separate two things that sound like one: the data-loss
tolerance of the *cutover*, and the RPO of the *steady state
afterwards*. They are different requirements with different answers,
and candidates who conflate them either over-engineer the cutover or
migrate into a target that can't hold the RPO. Secondarily: do you
know that "migrate Oracle" is at least two distinct projects depending
on whether the destination is still Oracle.

**Clarifying questions to ask before drawing anything**

- **Is the five-minute RPO for the migration, or for the system
  afterwards?** Almost always the latter. My cutover target is zero
  data loss regardless, and the five minutes is a property the target
  architecture has to hold every day for years.
- **Are we staying on Oracle or moving off it?** Same-engine is an
  infrastructure project with a data-transfer problem. Moving to
  PostgreSQL is an application project with a data-transfer problem
  attached, and the schedule differs by a factor of several.
- **How much logic lives in the database?** Stored procedures,
  packages, triggers, scheduled jobs. If a meaningful share of the
  business logic is in PL/SQL, a heterogeneous move is an application
  rewrite wearing a database migration's clothes, and I'd want that
  said out loud before anyone commits to a date.
- **What else connects to this database directly?** Reporting tools,
  extracts, a data warehouse feed, someone's spreadsheet with a direct
  connection. These are what break after cutover and they are never in
  the initial inventory.
- **What is the licensing position?** Licensing frequently decides the
  destination more than the technology does, and I'd rather know that
  constraint before proposing an architecture that conflicts with it.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Steady-state RPO of five minutes | Stated | — | A target-architecture property, not a cutover property |
| Cutover data loss target is zero | Stated by me | "I'd hold the cutover to zero loss regardless of the stated RPO — five minutes of lost orders is not what they meant" | Requires continuous replication plus a quiesce, not dump-and-restore |
| One-hour maintenance window | Stated | — | Rules out any mechanism whose bulk load happens inside the window |
| Destination engine not yet decided | Assumed | "I'd treat same-engine and cross-engine as two different projects and want the decision named before planning" | Sets scope by an order of magnitude |
| Direct consumers exist beyond the application | Assumed | "There is always a reporting connection nobody listed" | Adds a consumer-migration track in parallel |
| Rollback must be available after cutover | Stated by me | "Reverse replication armed before we flip, or we have a one-way door" | Makes the rollback design part of the cutover design |

**The answer, out loud**

The first thing I'd do is split the requirement, because the way it's
stated hides two different questions.

The five-minute RPO is a property of the target architecture. It says
that once we're running in the cloud, an unplanned failure may lose at
most five minutes of committed transactions. That's a replication and
backup design question — cross-region replica configuration, backup
cadence, and which tier from `03-comparisons/05-ha-dr-strategies.md`
we're actually buying. Five minutes of RPO with automatic failover
sits comfortably in the Active-Passive tier; it does not require
Active-Active, and I'd say that explicitly because "the business said
five minutes" often gets translated into the most expensive tier
available.

The cutover is a different question and my target there is zero loss,
not five minutes. Nobody means "it's fine to lose the last five
minutes of orders during the planned migration you chose the date
for." So the cutover design has to be a continuous-replication
approach with a short quiesce, and the one-hour window is not the time
to copy the data — it's the time to stop writes, let replication
drain, verify, and flip.

Which brings me to the destination decision, because it changes
everything downstream. If we stay on Oracle, this is an
infrastructure move: the data goes across with a replication
mechanism, the application's connection string changes, and the
project is measured in months. If we move to PostgreSQL — Cloud SQL
for PostgreSQL, or AlloyDB where the workload has an analytical
component alongside transactional (the positioning is in
`03-comparisons/02-storage-database-options.md`) — then Database
Migration Service handles the schema conversion and the continuous
replication, but the schema conversion is the easy half. The hard half
is everything in PL/SQL, and if the answer to my clarifying question
was "a lot," then this is an application project and I'd say so before
a date is committed. I'd rather be the person who said that in week
one than the person explaining it in month eight.

Assuming we're going heterogeneous with a manageable amount of
database logic, here's the sequence. Set up Database Migration Service
with continuous replication from the source. It does the initial full
load and then keeps applying changes, and that phase runs for weeks
while the application still points at Oracle — no window needed, no
risk. During that time I'm doing the two things that actually consume
the schedule: converting whatever database logic has to move into the
application or into the target's equivalents, and running the
application against a replicated copy to find behavioural differences
in data types, collation, null handling, date arithmetic, and
transaction isolation. Those differences are where heterogeneous
migrations actually fail, and they're all findable weeks ahead.

If instead the data is feeding analytical consumers as well, Datastream
is the change-data-capture path into BigQuery, and I'd deal with those
consumers separately — they're on a different cutover schedule and
trying to move them in the same window is unnecessary coupling.

The window itself, then, is short and scripted: stop the application's
writes, let replication drain to zero lag, run the verification —
row counts per table, checksums on the tables that matter, and a
small set of business assertions like "today's order total matches" —
then promote the target, change the connection configuration, and
start the application. Forty minutes of the hour is contingency.

Two things about rollback. First, reverse replication has to be armed
before the flip, or the moment the application writes one row to the
new database, going back means losing it. Second, the rollback
decision needs a deadline inside the window: if we're not green by
minute forty, we roll back and try again another day. That threshold
is agreed before the night, in writing, because at minute fifty-five
with everyone tired, "let's push on a bit" is the default human answer
and it's usually the wrong one.

What I would not do is a dump and restore inside the window. At any
meaningful size the arithmetic doesn't close, and even when it does,
it consumes the contingency that makes the verification step
meaningful.

**Architecture**

```
  SPLIT THE REQUIREMENT FIRST                                 ◄─ (1)
  ───────────────────────────
   "RPO 5 min"  ──┬─▶ STEADY STATE: target architecture property.
                  │   cross-region replica + backup cadence.
                  │   Active-Passive tier (05-ha-dr-strategies),
                  │   NOT Active-Active. Costs a fraction.
                  │
                  └─▶ CUTOVER: target is ZERO loss.  ◄─ (2)
                      Nobody means "lose 5 minutes of orders
                      during the migration we scheduled."

  DESTINATION DECIDES THE PROJECT SIZE                        ◄─ (3)
  ────────────────────────────────────
   same engine  ──▶ infrastructure move, months
   cross engine ──▶ DMS handles schema + replication, but
                    PL/SQL logic is an APPLICATION project.
                    Say so in week one, not month eight.

  TIMELINE — weeks of replication, one hour of cutover
  ───────────────────────────────────────────────────

  weeks -8 .. -1   ┌──────────────────────────────────────────┐
                   │ Database Migration Service: full load,   │
                   │ then CONTINUOUS replication. App still   │
                   │ points at the source. No window needed.  │
                   │                                   ◄─ (4) │
                   │ In parallel — the real schedule:         │
                   │  a. move DB logic out of PL/SQL          │
                   │  b. run the app against the replica and  │
                   │     hunt type/collation/null/date/       │
                   │     isolation differences         ◄─ (5) │
                   │  c. migrate direct consumers separately; │
                   │     Datastream → BigQuery for analytical │
                   │     consumers on their own schedule ◄(6) │
                   └───────────────────┬──────────────────────┘
                                       ▼
  THE ONE-HOUR WINDOW — scripted, 40 minutes of contingency
   min  0   stop application writes, drain in-flight
   min  5   replication lag to ZERO, confirmed              ◄─ (7)
   min 10   VERIFY: row counts per table, checksums on the
            tables that matter, business assertions
            ("today's order total matches")
   min 20   ARM REVERSE REPLICATION new ──▶ source         ◄─ (8)
   min 25   promote target, change connection config, start
   min 40   ROLLBACK DECISION POINT — not green, we go back.
            Agreed in writing beforehand.                   ◄─ (9)
   min 60   window closes

  NOT USED: dump-and-restore inside the window. The arithmetic
  rarely closes, and when it does it eats the contingency that
  makes verification meaningful.
```

**Every arrow explained:**

1. **Split the stated RPO into two requirements** — steady state and
   cutover. Conflating them produces either an over-engineered target
   tier or a cutover that accepts loss nobody actually authorised.
2. **Cutover target is zero loss** — and stating that plainly is
   usually welcomed, because it's what the business meant. It is also
   what forces continuous replication rather than a copy.
3. **Destination decides the project size** — same-engine is
   infrastructure; cross-engine is an application project with a
   database migration attached. The honest sizing conversation belongs
   in week one.
4. **Continuous replication runs for weeks, outside any window** —
   full load then change application, with the application still
   pointed at the source. No risk, no window, and it makes the
   window's job small.
5. **Behavioural differences are the real schedule** — data types,
   collation, null handling, date arithmetic, isolation semantics.
   These are where heterogeneous migrations fail, and every one of
   them is findable weeks early by running the application against
   the replica.
6. **Analytical consumers move on their own schedule** — Datastream
   for change data capture into BigQuery. Coupling them to the
   transactional cutover adds risk to the window for no benefit.
7. **Drain to zero lag before verifying** — verification against a
   lagging target proves nothing. This is why writes stop first and
   why the window's first ten minutes are not the copy.
8. **Reverse replication armed before the flip** — the instant the
   application writes one row to the new database, rolling back
   without reverse replication means losing it. Same rule as
   `D5-Q04` step 5.
9. **A rollback decision point inside the window, agreed in writing**
   — at minute fifty-five, tired, the human default is "push on a bit
   longer." The threshold has to be set when nobody is under pressure.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Reading the RPO | Two requirements: zero-loss cutover, 5-min steady state | One requirement applied to both | Prevents both over-buying the DR tier and under-protecting the cutover | When the system genuinely tolerates cutover loss (append-only telemetry, replayable feeds) — then a simpler copy-and-switch is legitimate |
| Transfer mechanism | Continuous replication (Database Migration Service) | Export, copy, import inside the window | The window is for verification, not for moving data | When the database is small and static and the window is generous — then a copy is simpler and has fewer moving parts |
| Destination engine | Decide explicitly before planning | Treat "migrate the database" as one project regardless | Cross-engine drags an application project along with it | When licensing or a vendor support matrix removes the choice entirely — then it's decided for you and the plan follows |
| Analytical consumers | Separate cutover via change data capture | Move everything in the same window | Adds risk to a fixed window for a consumer with no window requirement | When the analytical consumer is the only consumer, in which case the transactional cutover isn't the constraint |
| Rollback | Reverse replication armed pre-flip, with a decision deadline | Restore from backup if it goes wrong | Restoring loses everything written after the flip and takes longer than the window | When the application can be held read-only for a long verification period — then a backup is a sufficient safety net and reverse replication is extra machinery |

**Making it concrete**

```bash
# Pre-window gate: replication lag must be zero before anything else.
# This is a gate, not a report — the window does not proceed on a
# non-zero value.
gcloud datamigration migration-jobs describe MIGRATION_JOB_ID \
  --region=REGION \
  --format="value(state,phase)"

# Verification is per-table and business-level, not a single count.
# COUNTS_QUERY and ASSERTIONS_QUERY are held in the runbook and
# rehearsed against the replica before the night itself.
```

The reason this is a gate rather than a check is behavioural. A
verification step that produces a number somebody interprets under
time pressure will be interpreted generously. A step that refuses to
continue will not.

**What a weak answer sounds like**

- "We'd take a dump, copy it up, and restore it in the window." — the
  arithmetic rarely closes at production sizes, and when it does it
  consumes the contingency that makes verification possible.
- "The RPO is five minutes, so we can afford to lose five minutes
  during the cutover." — a literal reading of a requirement that was
  written about unplanned failure. Nobody authorised losing orders
  during a migration they scheduled.
- "We'd move to PostgreSQL — it's cheaper and it's managed." — may
  well be right, and it isn't a database migration once there's
  significant logic in PL/SQL. Saying that upfront is the difference
  between a plan and an optimistic estimate.
- "We'd cut over and keep a backup in case we need to roll back." —
  restoring a backup loses everything written after the flip and takes
  longer than the window allows. Reverse replication is the rollback.

**Common wrong turns**

- **Designing the DR tier from the word "critical" rather than the
  stated number.** Five minutes is comfortably Active-Passive.
  Recover by pricing the tier against the stated RPO and RTO, not
  against the adjectives.
- **Discovering direct consumers at cutover.** The reporting tool with
  a hard-coded connection string is always there. Recover by auditing
  actual connections to the source database, not the documented ones.
- **Testing the migration but not the rollback.** The rehearsal proves
  the forward path only, and the rollback runs for the first time
  under pressure. Recover by rehearsing both, in the same session.
- **Letting the window's contingency get spent on the copy.** Then
  verification is rushed and the rollback deadline arrives during it.
  Recover by moving all bulk work out of the window entirely.

**Follow-up probes the interviewer asks next**

1. **"Replication lag won't reach zero — it sits at forty seconds
   under load. What do you do?"** — don't cut over. Forty seconds of
   lag at quiesce is fine (writes have stopped, it drains), but lag
   that won't converge *while writes are stopped* means something is
   still writing. I'd find that writer first; it's usually a
   scheduled job or a second application nobody listed.
2. **"You're at minute forty-five, mostly green, one assertion
   failing. Go or roll back?"** — roll back. The threshold was agreed
   precisely so this isn't a judgement call at minute forty-five, and
   a failing business assertion is the one class of signal I would
   never override. We learn what it was and go again in two weeks.
3. **"Escalate: what's the blast radius if the verification passes but
   the data is subtly wrong?"** — the application runs on incorrect
   data, the source gets decommissioned on schedule, and the problem
   surfaces in a reconciliation weeks later with no clean source to
   compare against. That's why the source stays up and receiving
   reverse replication well past the cutover, and why decommission is
   a dated decision rather than a cleanup task.
4. **"The DBAs don't want this to happen at all. How do you handle
   that?"** — take it seriously, because they usually know something
   specific. Most commonly it's a behaviour of the current system
   that isn't documented anywhere else. I'd get them into the
   verification design rather than around it — their objection is
   also, organisationally, a signal about whose job changes after this
   lands, which is `D5-Q14`'s question and worth addressing directly.
5. **"How does this change if the window is fifteen minutes, not
   sixty?"** — the sequence is identical, the contingency isn't. At
   fifteen minutes I'd want the verification fully automated and
   pre-rehearsed, a rollback deadline at minute eight, and I'd push
   to move the assertions that can run against a lagging replica out
   of the window entirely.
6. **"Would you ever migrate this with no window at all?"** — yes, via
   the per-entity write-authority flip in `D5-Q04`, but only if the
   data model partitions cleanly by entity. For a shared relational
   core with cross-entity transactions, the short quiesce is honest
   and the alternative is elaborate machinery that achieves the same
   outcome with more ways to be wrong.

**Cross-references**

- `03-comparisons/04-migration-strategies.md` — the data-migration
  mechanism matrix; the Database Migration Service row is the spine of
  this answer.
- `03-comparisons/05-ha-dr-strategies.md` — the tier names used for
  the steady-state RPO; Active-Passive, exactly as named there.
- `03-comparisons/02-storage-database-options.md` — Cloud SQL versus
  AlloyDB versus Spanner positioning for the destination.
- `D5-Q04` for the no-window variant, `D5-Q07` for when the data
  volume itself is the binding constraint.

---
### D5-Q07 — "Four petabytes of archived imagery, and the datacenter contract ends in ninety days. How does the data get there?"

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.4, 2.2 |
| **Axis** | time |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D5-Q01` |

**What the interviewer is actually testing**

Whether you do the arithmetic out loud before choosing a mechanism,
and whether you understand that the bulk transfer is the easy half.
The interesting part of a large offline transfer is the delta — what
changes while the bulk is in flight — and the verification that the
four petabytes that arrived are the four petabytes that left.

**Clarifying questions to ask before drawing anything**

- **How much of the four petabytes is actually changing?** If it's a
  cold archive with a thin write layer, this is one problem. If it's
  four petabytes of working set under active modification, it's a
  much harder one and the ninety days may not be achievable at all.
- **What egress bandwidth is genuinely available, and what else uses
  it?** Not the circuit's rated capacity — what's spare during the
  hours we can use it. A link that's busy in business hours halves the
  effective rate immediately.
- **Does the application cut over at the same time as the data, or
  later?** If the application follows months later, the data can land
  early and sit. If they cut together, the last delta becomes the
  critical path.
- **What is the object-size distribution?** Four petabytes in large
  image files behaves entirely differently from four petabytes in
  billions of small files, where the per-object overhead dominates and
  the effective rate collapses.
- **What does verification have to prove, and to whom?** If this is
  regulated content, a checksum manifest signed off by a specific
  party is part of the deliverable, and building it is a work item
  rather than an afterthought.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Ninety days to contract end | Stated | — | The transfer plan is backwards-planned from this, with the delta last |
| Most of the archive is cold | Assumed | "I'd want to confirm the write rate against the archive; if a large share is hot, the plan changes shape" | Determines whether an offline seed is viable at all |
| Available bandwidth is a fraction of the circuit | Assumed | "I'll size on measured spare capacity, not the rated capacity" | Decides offline versus online before anything else |
| Application cutover is separate from data landing | Assumed | "Data landing and application cutover are different milestones; coupling them shortens the runway" | Lets the bulk land early |
| Verification is required and must be evidenced | Assumed | "I'll assume we must be able to prove completeness, not just believe it" | Makes the manifest a deliverable |
| Destination storage class is decided upfront | Stated by me | "Landing four petabytes in the wrong class and re-tiering later is an avoidable cost" | Lifecycle policy set before the first object lands |

**The answer, out loud**

I'd start with arithmetic on the whiteboard, because this decision
gets made by a number and everything else follows from it. Four
petabytes, ninety days, minus the time we need at the end for the
delta and the verification — call it seventy days of usable transfer.
That gives a required sustained rate. Then I'd ask what rate the link
can actually hold, sustained, during the hours we can use it. If the
required rate exceeds the available rate, the network is not the
mechanism and there's nothing to debate. If it's close, the network is
still not the mechanism, because "close" means no contingency against
ninety days that cannot move.

So in most versions of this scenario, the answer is a hybrid: an
offline seed for the bulk, and an online path for the delta and the
catch-up. Transfer Appliance takes the cold archive, and Storage
Transfer Service handles everything that changed while the appliance
was in transit, plus everything that changes after.

The part I'd spend the most time on is the seam between those two,
because that's where this goes wrong. The appliance is offline for its
whole round trip — ingest at our site, shipping, ingest at Google's
end. During that window the source keeps changing. So I need a
precise answer to "what is the appliance's content as of when," and a
delta pass that covers everything after that timestamp. Concretely:
freeze a manifest at appliance-seal time, transfer to the appliance
against that manifest, and then run Storage Transfer Service
continuously from the seal timestamp onward so the delta is already
flowing while the appliance is physically in transit. When the
appliance lands, the delta is small and recent rather than being the
entire in-transit window's worth of change discovered at the end.

For the delta path itself, Storage Transfer Service in its incremental
mode is the right tool — it compares source and destination and moves
what's missing, which means it's also the reconciliation mechanism, not
just the transfer mechanism. A final pass run after writes are stopped
is what proves the destination is complete.

The verification step deserves its own attention. Checksums per
object, compared against the manifest that was frozen at seal time
plus the delta's own manifest. I'd want a count and a byte total
matching, and a spot-check of a random sample actually opened and
read by the consuming application, because "the bytes are present" and
"the application can use them" are different claims and only the
second one matters.

Two things I'd decide before the first object lands. First, the
storage class and lifecycle policy at the destination, because
re-tiering four petabytes after the fact is avoidable work — if this
is an archive that gets read rarely, it should land in a colder class
directly, with lifecycle rules for anything that turns out to be hot.
Second, the layout: the object naming and prefix structure at the
destination should reflect how it will be read, not how it was stored
on the source filesystem. Lifting the source's directory structure
verbatim is easy and frequently produces a prefix layout that's
awkward for years.

Where I'd push back is on the framing that data landing equals
migration. The application cutover is a separate milestone. If the
data can land in week six and the application cuts over in week
eleven, the ninety-day risk is much lower than a plan where both
happen in week twelve. I'd sequence them apart deliberately.

And the case for not using Transfer Appliance: if the archive is
actively changing at a rate the delta pass can't absorb, the offline
seed is chasing a moving target and the catch-up never converges.
That's the signal to either freeze the source earlier than planned, or
accept that some portion migrates as a live replication problem rather
than a bulk transfer. It's worth naming that boundary out loud rather
than assuming appliance-plus-delta always works.

**Architecture**

```
  STEP 0 — THE ARITHMETIC, OUT LOUD, FIRST                    ◄─ (1)
  ────────────────────────────────────────
   4 PB  ÷  (90 days − delta window − verification window)
         =  required SUSTAINED rate
   compare against MEASURED spare capacity in usable hours,
   not the circuit's rated capacity
      required > available  ──▶ offline seed. No debate.
      required ≈ available  ──▶ still offline. "Close" means
                                zero contingency against a date
                                that cannot move.

  THE HYBRID PLAN — offline seed + online delta
  ─────────────────────────────────────────────

   day 0     ┌────────────────────────────────────────────┐
             │ FREEZE A MANIFEST at appliance seal time   │ ◄─ (2)
             │ "the appliance contains exactly this, as   │
             │  of exactly this timestamp"                │
             └──────────────────┬─────────────────────────┘
                                ▼
   day 0-7   ┌────────────────────────────────────────────┐
             │ TRANSFER APPLIANCE ingest against the      │ ◄─ (3)
             │ manifest — the cold bulk                   │
             └──────────────────┬─────────────────────────┘
                                ▼
   day 7-25  ┌──────────────────┴──────────┬──────────────┐
             │ APPLIANCE IN TRANSIT        │ DELTA ALREADY│
             │ (offline the whole time)    │ FLOWING      │ ◄─ (4)
             │                             │ Storage      │
             │                             │ Transfer     │
             │                             │ Service,     │
             │                             │ incremental, │
             │                             │ from the seal│
             │                             │ timestamp on │
             └──────────────────┬──────────┴──────────────┘
                                ▼
   day 25    ┌────────────────────────────────────────────┐
             │ APPLIANCE LANDS — delta is small and       │
             │ recent, not the whole transit window  ◄─(5)│
             └──────────────────┬─────────────────────────┘
                                ▼
   day 25-60 ┌────────────────────────────────────────────┐
             │ STS continues; it is also the              │ ◄─ (6)
             │ RECONCILIATION mechanism, not just         │
             │ transport — it moves what is missing       │
             └──────────────────┬─────────────────────────┘
                                ▼
   day 60    ┌────────────────────────────────────────────┐
             │ STOP WRITES → FINAL STS PASS → VERIFY ◄─(7)│
             │  object count + byte total vs manifests    │
             │  per-object checksums                      │
             │  random sample OPENED AND READ by the      │
             │  consuming application                     │
             └──────────────────┬─────────────────────────┘
                                ▼
   day 60-90 APPLICATION CUTOVER — a SEPARATE milestone ◄─ (8)
             deliberately not the same week as data landing

  DECIDED BEFORE THE FIRST OBJECT LANDS:                      ◄─ (9)
   storage class + lifecycle policy (re-tiering 4 PB later is
   avoidable work), and a prefix layout reflecting how the data
   will be READ, not how the source filesystem stored it
```

**Every arrow explained:**

1. **The arithmetic before the mechanism** — required sustained rate
   against measured spare capacity. This single comparison decides
   offline versus online, and doing it out loud is most of what the
   panel is listening for.
2. **A manifest frozen at seal time** — the appliance's content is
   defined as "exactly this, as of exactly this timestamp." Without
   that, the delta has no defined starting point and the catch-up is
   guesswork.
3. **Transfer Appliance for the cold bulk** — the mechanism for the
   case where network transfer cannot close the arithmetic. Don't use
   it when the data is changing faster than a delta pass can absorb;
   then the seed chases a moving target and never converges.
4. **The delta flows while the appliance is in transit** — this is the
   step most plans omit. Starting the delta only after the appliance
   lands means discovering the entire transit window's worth of change
   at the worst possible moment.
5. **Small, recent delta at landing** — the payoff from (4). It turns
   the catch-up from a second bulk transfer into a short pass.
6. **Storage Transfer Service is also the reconciliation** — it
   compares source and destination and moves what's missing, so the
   same tool that transports is the one that proves completeness.
7. **Verification proves usability, not just presence** — counts,
   byte totals and checksums establish the bytes arrived; a random
   sample actually opened by the consuming application establishes
   that they are usable, which is the claim that matters.
8. **Application cutover is a separate milestone** — sequencing them
   apart pulls risk out of the final weeks. Coupling them is a
   self-inflicted deadline.
9. **Storage class, lifecycle and prefix layout decided upfront** —
   re-tiering petabytes later is avoidable cost, and lifting the
   source's directory structure verbatim produces a prefix layout the
   organisation lives with for years.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Bulk mechanism | Transfer Appliance (offline seed) | Storage Transfer Service over the network for everything | The arithmetic doesn't close against a fixed date with no contingency | When measured spare bandwidth comfortably exceeds the required rate with margin — then online is simpler, continuous, and has no shipping risk |
| Delta timing | Delta starts at seal time, runs during transit | Delta starts when the appliance lands | Avoids discovering the whole transit window's change at the end | When the source is genuinely frozen for the transit period — a real option for a decommissioned archive, and worth asking for |
| Verification | Counts, checksums, plus a sample read by the consuming app | Checksums alone | "Bytes present" and "application can use them" are different claims | When the consumer is a byte-for-byte archive with no application semantics — then checksums are the whole requirement |
| Storage class | Decided before landing, with lifecycle rules | Land everything in a standard class and re-tier later | Re-tiering petabytes is avoidable work and avoidable cost | When the access pattern is genuinely unknown — then land in a class that tolerates being wrong and use lifecycle rules to settle it automatically |
| Milestone coupling | Data landing and application cutover separate | One combined cutover milestone | Separating them takes risk out of the final weeks | When the data is only useful with the application and holding both is cheap — a small, self-contained system where the combined window is short |

**Making it concrete**

```bash
# The delta is defined against the seal timestamp, not against "now".
# SEAL_TS is recorded when the appliance is sealed and never changes.
gcloud transfer jobs create SOURCE_PATH gs://DEST_BUCKET/PREFIX \
  --include-modified-after-absolute=SEAL_TS \
  --overwrite-when=different \
  --name=JOB_NAME

# Final pass after writes stop: same job, no time filter, so it
# reconciles the whole namespace rather than a window.
```

The `--overwrite-when=different` behaviour is what makes the same job
serve as both transport and reconciliation — it is comparing, not
blindly copying, which is why the final pass is evidence rather than
just another transfer.

**What a weak answer sounds like**

- "We'd use Transfer Appliance because it's petabytes." — right tool,
  no reasoning. The follow-up is "how much fits, and what about the
  data that changes while it's shipping," and there's nowhere to go
  without the arithmetic.
- "We'd copy it over the Interconnect, it's fast." — fast is not a
  rate. The answer to this question is a number compared against
  another number, and skipping that is the failure.
- "We'd verify with a row count at the end." — an object count proves
  the population size and nothing about content. For four petabytes
  of imagery it's the cheapest possible check masquerading as
  assurance.
- "Once the data's there we cut the application over." — folds two
  milestones into one week at the end of a fixed deadline, which is
  precisely the risk the ninety-day constraint should be pushing us
  away from.

**Common wrong turns**

- **Sizing on rated bandwidth.** The circuit's capacity is not the
  spare capacity during usable hours. Recover by measuring actual
  throughput over a representative week before committing.
- **Ignoring object-size distribution.** Billions of small objects
  transfer at a fraction of the rate of large ones. Recover by
  profiling the distribution and, where it's pathological, packing
  small objects before transfer.
- **Starting the delta after the appliance lands.** It converts the
  catch-up into a second bulk transfer at the worst moment. Recover by
  defining the seal timestamp and starting the incremental job
  immediately.
- **Landing in the wrong storage class.** It's invisible until the
  bill or the retrieval latency arrives. Recover by deciding class and
  lifecycle before the first object, not after the last.

**Follow-up probes the interviewer asks next**

1. **"The appliance's capacity is less than four petabytes. Now
   what?"** — multiple appliances in sequence or in parallel, each
   with its own sealed manifest and its own delta window, and the
   sequencing becomes part of the plan. The important consequence is
   that the manifests must partition the namespace cleanly, or the
   reconciliation can't tell a missing object from one on a later
   appliance.
2. **"The contract slips to sixty days. Does the plan survive?"** —
   the transfer does, because the offline seed's timeline is
   dominated by shipping rather than by the deadline. What doesn't
   survive is the separation between data landing and application
   cutover, and I'd say explicitly that the compression is being paid
   for in risk at the end.
3. **"Escalate this: the appliance is lost or damaged in transit."** —
   we've lost time, not data, because the source is still intact; the
   plan has to include that possibility as a schedule risk with a
   defined restart point. What it must *not* include is having already
   deleted anything from the source, which is why source deletion is
   gated on verification at the destination, not on the appliance
   being handed over.
4. **"Who signs off that the data is complete, and when?"** — the
   business owner of the archive, against the manifest evidence, and
   before any source deletion. That signature is organisationally
   important: it's the moment the risk transfers, and if nobody will
   sign, that usually means the verification isn't proving what they
   need it to prove.
5. **"Half the archive turns out to be duplicated or never read.
   Does that change anything?"** — substantially. That's a retire
   conversation, and it's the cheapest lever available on a
   four-petabyte problem. I'd want the access-log analysis done in
   the first two weeks precisely because it might remove a large
   fraction of the work before any of it starts.
6. **"What if the consuming application can't read from object storage
   at all?"** — then the destination is not a bucket and the plan
   changes; a file-shaped consumer needs a file-shaped target, and
   that's a different cost and access profile. Discovering this after
   four petabytes have landed is the expensive version, which is why
   the sample-read verification exists in the plan at all.

**Cross-references**

- `03-comparisons/04-migration-strategies.md` — the data-migration
  mechanism matrix; Transfer Appliance and Storage Transfer Service
  rows are the basis of this choice and are not restated here.
- `D5-Q01` for where this sits in the wave plan; `D5-Q06` for the
  transactional-database version of the same deadline pressure.
- `03-comparisons/02-storage-database-options.md` for the destination
  storage-class decision.

---

### D5-Q08 — "Four hundred dealer sites, each with a small server, all needing to reach the platform. Design the connectivity — and tell me how it actually gets built out over eighteen months."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 2.1, 1.3 |
| **Axis** | time |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D5-Q05` |

**What the interviewer is actually testing**

Whether you recognise that the topology decision takes a week and the
rollout takes eighteen months, and that the second one is the
question. Anyone can name a hub-and-spoke model. The Staff+ signal is
in the onboarding mechanics, the address-space problem, and what
happens at a site whose link is down — because with four hundred
sites, some site is always down.

**Clarifying questions to ask before drawing anything**

- **Are the dealers independent businesses or our own branches?** It
  changes everything. Independent businesses mean we don't control
  their network, can't mandate their equipment, and can't assume
  anyone technical is on site. Our own branches means we can.
- **What actually crosses the link?** Interactive traffic to a
  platform, or periodic data exchange? If it's inventory and service
  records moving in batches, the availability requirement per site is
  much softer than it first sounds, and that changes the design.
- **Do sites need to reach each other, or only the platform?**
  Site-to-site is a very different topology from four hundred spokes
  reaching one centre, and the answer is almost always "only the
  platform," which simplifies everything.
- **Is there an existing network vendor relationship at the sites?**
  If there's an SD-WAN estate already deployed, integrating with it is
  usually far cheaper than replacing it, and it changes the spoke
  type.
- **What's the address-space situation across four hundred sites?**
  Overlapping private ranges is the default assumption and it's the
  single hardest constraint in this question.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| ~400 sites, growing | Stated | — | Rules out any full-mesh model immediately |
| Modest per-site bandwidth | Assumed | "Small server, periodic exchange — I'll assume tens of megabits, not gigabits, per site" | Makes VPN-class links appropriate per site |
| Sites reach the platform, not each other | Assumed | "If dealers need to talk to each other, say so now — it's a different topology" | Keeps the hub simple |
| Overlapping private address space | Assumed | "Four hundred independently-run sites almost certainly overlap on private ranges" | Forces a translation boundary rather than renumbering |
| Central policy visibility required | Stated | — | Points at a managed hub rather than independently-configured tunnels |
| Sites tolerate being offline briefly | Assumed | "I'd design for store-and-forward at the edge rather than a synchronous dependency" | Determines the application's behaviour, not just the network's |

**The answer, out loud**

I'd separate the two halves immediately, because they have different
answers and different timescales. The topology is a week's work and
it's a solved pattern. The rollout is eighteen months and it's an
operations design, not a network design.

On topology: four hundred sites with modest bandwidth, growing, with
central policy visibility as a stated requirement, is the canonical
hub-and-spoke case. Network Connectivity Center as the hub, HA VPN
tunnels as the spokes for sites where we're terminating directly, and
router-appliance spokes where there's an existing SD-WAN estate we
should integrate with rather than replace. The reasoning behind that
choice is in `03-comparisons/03-networking-connectivity.md` and I
wouldn't re-derive it in the room beyond the one line that matters:
peering meshes grow quadratically and four hundred sites makes that
arithmetic absurd, while a hub grows linearly in spokes.

Where I would not use per-site Interconnect: everywhere in the dealer
network. The bandwidth profile doesn't justify it and the provisioning
time makes a four-hundred-site rollout impossible. Where I *would*
use Interconnect is the small number of high-volume sites — the
manufacturing or distribution locations with sustained throughput and
a durable physical presence. Those are a different class of site and
should get a different answer, and noticing that the estate isn't
homogeneous is part of the design.

Now the harder half. The address space. Four hundred independently
operated sites will overlap on private ranges — several of them will
be on the same default subnet their router shipped with. The naive
answer is to renumber, and I'd reject it: renumbering four hundred
third-party sites is a project with four hundred negotiations in it
and it will not finish. Instead I'd push the translation to the edge:
each site NATs to a unique address block assigned by us before the
tunnel, so what arrives at the hub is already unambiguous. That makes
the site's internal addressing our problem exactly zero times. The
cost is that we can't initiate connections inbound to arbitrary site
hosts, and I'd accept that deliberately — for this traffic pattern we
don't need to, and if we later do, it's a per-site exception rather
than a design assumption.

The rollout is where the eighteen months goes, so that's what I'd draw
as a process. The core idea is that site onboarding must be a
repeatable artifact, not a project. That means: a Terraform module
that creates the spoke, the tunnel, the routes and the monitoring in
one apply; a pre-generated configuration bundle the dealer's own IT
(or a shipped pre-configured device) applies at their end with no
architecture decisions; an automated validation that confirms the
tunnel is up, routes propagate and a synthetic transaction completes,
before the site is marked live. If onboarding a site requires a
network engineer to think, we can do maybe two a week and the
arithmetic fails. If it's a templated apply plus a validation, we can
do twenty.

I'd stage the rollout by region and by dealer cohort, starting with
five friendly sites in one region as a pilot, then a wave per region.
And I'd treat the first two cohorts the way `D5-Q02` treats wave one —
their purpose is to correct the runbook, not to hit a number.

The last piece, and the one that gets skipped: what happens when a
site's link is down. With four hundred sites at any realistic
availability, several are offline right now. So the application at the
dealer end must store and forward rather than depend synchronously on
the platform, and the platform must tolerate a site reconnecting with
hours of queued data and delivering it out of order. That's an
application design constraint that comes out of a connectivity
question, and naming it is a large part of what separates an
architect's answer from a network engineer's.

**Architecture**

```
  TOPOLOGY (one week of design)        ROLLOUT (eighteen months)
  ─────────────────────────────        ─────────────────────────

         ┌──────────────────┐          ┌─────────────────────────┐
         │ NCC HUB          │          │ ONBOARDING AS AN         │
         │ central policy + │          │ ARTIFACT, NOT A PROJECT  │
         │ route propagation│  ◄─(1)   │                    ◄─(5) │
         └───┬───┬───┬──────┘          │ a. Terraform module:     │
             │   │   │                 │    spoke + tunnel +      │
    ┌────────┘   │   └────────┐        │    routes + monitoring,  │
    ▼            ▼            ▼        │    one apply             │
 ┌──────┐   ┌──────┐    ┌─────────┐    │ b. pre-generated config  │
 │HA VPN│   │HA VPN│    │ router  │    │    bundle for the dealer │
 │spoke │   │spoke │    │appliance│    │    end — zero decisions  │
 │site 1│   │site 2│    │ spoke   │    │ c. automated validation: │
 └──┬───┘   └──┬───┘    │(existing│    │    tunnel up, routes     │
    │          │        │ SD-WAN) │    │    propagate, synthetic  │
    │          │        └────┬────┘    │    transaction passes    │
    │          │             │         │    → only then "live"    │
    ▼          ▼             ▼         └───────────┬─────────────┘
 ┌────────────────────────────────┐                ▼
 │ EDGE NAT AT EVERY SITE   ◄─(2) │    ┌─────────────────────────┐
 │ site NATs to a unique block we │    │ STAGED BY REGION        │
 │ assign, BEFORE the tunnel.     │    │ 5 friendly sites = pilot│
 │ Their internal addressing is   │    │ (purpose: correct the   │
 │ never our problem.             │    │  runbook, not hit a     │
 │ Cost, accepted deliberately:   │    │  number — cf. D5-Q02)   │
 │ no inbound-initiated sessions  │    │ then a wave per region  │
 │ to arbitrary site hosts ◄─(3)  │    │                    ◄─(6)│
 └────────────────────────────────┘    └───────────┬─────────────┘
                                                    ▼
  NOT UNIFORM: the estate has two classes    ┌──────────────────────┐
  ┌──────────────────────────────────┐       │ SOME SITE IS ALWAYS  │
  │ 400 dealer sites → VPN spokes    │       │ DOWN            ◄─(7)│
  │ few high-volume manufacturing /  │◄─(4)  │ so the DEALER app    │
  │ distribution sites → Interconnect│       │ stores and forwards; │
  │ (sustained throughput, durable   │       │ the platform accepts │
  │  physical presence)              │       │ hours of queued,     │
  └──────────────────────────────────┘       │ out-of-order data    │
                                             └──────────────────────┘
  RATE CHECK: if onboarding needs an engineer to THINK, ~2 sites
  a week and the plan fails. Templated apply + validation → ~20. ◄─(8)

  GROWTH: a new dealer is one spoke, not a new mesh edge.       ◄─(9)
```

**Every arrow explained:**

1. **Network Connectivity Center as the hub** — spokes grow linearly;
   a peering mesh grows quadratically, which at four hundred sites is
   not a design, it's an arithmetic failure. The hub also satisfies the
   stated central-policy-visibility requirement directly.
2. **Edge NAT to an assigned unique block** — the answer to
   overlapping private ranges across four hundred independently
   operated sites. Wrong alternative: renumbering the sites, which is
   four hundred negotiations with third parties and will not finish.
3. **The accepted cost of edge NAT** — we cannot initiate inbound
   sessions to arbitrary hosts at a site. For this traffic pattern we
   don't need to; if a specific site later does, it's an exception,
   not a redesign. Naming the cost is the point.
4. **The estate is not uniform** — a handful of manufacturing or
   distribution sites with sustained throughput and durable presence
   get Interconnect; the four hundred dealers get VPN spokes.
   Per-dealer Interconnect fails on both provisioning time and
   bandwidth profile.
5. **Onboarding as a repeatable artifact** — one Terraform apply, a
   pre-generated bundle for the far end, and an automated validation
   gate. This is the actual design deliverable for the eighteen-month
   half of the question.
6. **Pilot cohort exists to correct the runbook** — same logic as
   wave one in `D5-Q02`. Five friendly sites, then waves by region.
7. **Some site is always down** — at four hundred sites this is a
   permanent condition, not an incident. So the dealer-end
   application stores and forwards, and the platform tolerates a
   reconnecting site delivering hours of queued, out-of-order data.
8. **The rate check decides whether the plan is real** — a
   thinking-required onboarding gives roughly two sites a week and
   misses the deadline by years; a templated one gives an order of
   magnitude more. This number is worth computing out loud.
9. **Growth is one spoke** — the hub model means a new dealer next
   year is an onboarding run, not a topology change. That's the
   property being bought.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Topology | NCC hub with VPN spokes | Full-mesh VPC peering or per-site tunnels managed individually | Spoke count grows linearly and policy is visible centrally | When there are only a handful of sites with no growth expected — then a hub is management overhead for no benefit |
| Per-site link | HA VPN | Dedicated or Partner Interconnect per dealer | Provisioning in hours, appropriate to the bandwidth profile | When a specific site carries sustained high throughput and has durable physical presence — manufacturing and distribution sites, which is why the estate is split |
| Existing SD-WAN | Integrate as router-appliance spokes | Replace it with our own tunnels | Preserves an investment and removes four hundred equipment changes from the plan | When the existing estate can't meet the security or routing requirements — then replacement is honest, and it's a much bigger programme |
| Address overlap | Edge NAT to assigned unique blocks | Renumber the sites | Renumbering third-party sites is four hundred negotiations that won't complete | When the sites are our own branches under our control and the estate is small enough to renumber once, cleanly |
| Site outage behaviour | Store-and-forward at the dealer edge | Synchronous dependency on the platform | With four hundred sites, several are always offline; synchronous means constant partial failure | When the site's function genuinely requires live platform data (real-time pricing or authorisation) — then the link's availability becomes a per-site requirement and cost |

**What a weak answer sounds like**

- "Interconnect to each dealer for reliability." — four hundred
  physical circuits, weeks of provisioning each, for tens of megabits
  of periodic traffic. The provisioning timeline alone ends the plan.
- "Set up VPN tunnels to each site." — the topology is arguably right
  and the answer stops before the actual question. Four hundred
  independently configured tunnels with no hub is exactly the
  no-central-visibility problem the requirement named.
- "We'd standardise all dealer networks on one address plan." — true
  in a world where we control four hundred independent businesses'
  networks. In this one it's a multi-year negotiation that blocks the
  connectivity project behind it.
- "The dealer application will call the platform API directly." — it
  will, and then it will fail every time that site's link drops, which
  at four hundred sites is constantly. The design has to assume
  disconnection as a normal state.

**Common wrong turns**

- **Solving the topology and stopping.** The topology is the easy
  week. Recover by moving straight to onboarding mechanics — the
  panel asked how it gets built out, and that's the answer.
- **Assuming a technical person at each site.** Independent dealers
  don't have one. Recover by shipping a pre-configured device or a
  bundle with zero decisions in it.
- **Treating a failed site as an incident.** At this count, several
  are down at all times. Recover by reframing site availability as a
  fleet statistic with a threshold, not as per-site incidents.
- **Piloting with the most demanding dealer.** They'll surface every
  problem at once and the runbook can't absorb them in parallel.
  Recover by piloting with friendly sites and *scheduling* the
  demanding one as cohort three.

**Follow-up probes the interviewer asks next**

1. **"You're at 250 sites and the hub's route table is becoming
   unwieldy. What happens?"** — route summarisation per region, and if
   the spoke count is genuinely pressing against limits, regional hubs
   with a small inter-hub topology rather than one global hub. Worth
   planning the address blocks for summarisation from site one, since
   retrofitting a summarisable address plan across 250 live sites is
   the expensive version of this fix.
2. **"A dealer refuses to allow our equipment on their network."** —
   then they're a router-appliance or a client-initiated case, and I'd
   want a documented second pattern rather than a bespoke arrangement.
   With four hundred independent businesses, "some will refuse" is a
   design input; at most two supported patterns, though, or operations
   becomes untenable.
3. **"Escalate this: the hub has a problem. What's the blast
   radius?"** — every site at once, which is the price of
   centralisation. Mitigation is redundancy within the hub region and
   an explicit answer to whether sites can operate disconnected — and
   because we already designed store-and-forward, they can, which
   turns a total outage into deferred data rather than stopped
   business. That's the argument for the store-and-forward decision
   paying for itself twice.
4. **"Who runs this in two years — the platform team or a network
   operations function?"** — a network operations function with the
   onboarding automation owned by the platform team. The
   organisational risk is the opposite arrangement: if the platform
   team also runs four hundred site incidents, they stop doing
   platform work within a quarter.
5. **"How do you know a site is healthy without someone checking?"** —
   the synthetic transaction from the onboarding validation keeps
   running as a heartbeat, so site health is a platform-visible metric
   rather than a dealer phoning in. At this scale, health has to be
   observed centrally or it isn't observed.
6. **"Eighteen months in, sixty sites still aren't migrated. What do
   you do?"** — find out whether it's one reason or sixty. One reason
   is a product problem with the onboarding artifact and it's fixable;
   sixty reasons means the tail is genuinely heterogeneous and needs a
   bespoke cohort with its own budget. Same tail problem as `D5-Q01`,
   arriving through a different door.

**Cross-references**

- `03-comparisons/03-networking-connectivity.md` — the hybrid
  connectivity matrix, the NCC growth signal and the mesh-versus-hub
  diagram; not restated here.
- `04-architectures/case-study-terramearth.md` — a dealer network with
  exactly this shape, including the durable (not migration-phase)
  hybrid footprint.
- `D5-Q05` for the single-datacenter version of the link, `D5-Q09` for
  what runs at the sites if they need a common platform.

---
### D5-Q09 — "We'll be running containers on-prem, in Google Cloud, and on a second cloud for the next few years. Design the fleet topology."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 1.3, 2.1, 5.1 |
| **Axis** | time |
| **Whiteboard time** | 40–50 min |
| **Reads well after** | `D5-Q05` |

**What the interviewer is actually testing**

Whether you know what a fleet actually gives you and, more
importantly, what it doesn't. The failure mode here is a candidate who
believes a multi-environment Kubernetes platform makes three
environments into one environment. It doesn't — it makes policy,
identity and configuration uniform while networking, load balancing,
storage and the support model stay stubbornly local. Being precise
about that line is the whole question.

**Clarifying questions to ask before drawing anything**

- **Why is there a second cloud?** A regulatory requirement, an
  acquisition, a customer contract, or an executive preference for
  optionality. Each of those has a different expected duration, and
  duration decides how much machinery is worth building.
- **Is the second cloud permanent, or is it a migration destination or
  origin?** If it's a transitional state, I'd build much less and set
  an end date, the same way `D5-Q05` treats the hybrid link.
- **Do the same workloads need to run in all three, or do different
  workloads live in different places?** Identical workloads everywhere
  is a portability requirement; different workloads in different
  places is a management-consistency requirement, and those justify
  very different investments.
- **What does on-prem actually mean here — a supported Kubernetes
  distribution, or an existing cluster somebody built?** The answer
  determines whether we're registering something or replacing it.
- **Who operates clusters today, and how many of them are there?** A
  fleet doesn't reduce the number of things to operate; it makes them
  consistent. If nobody is operating Kubernetes well in one place,
  three places is not the fix.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Three environments for several years | Stated | — | Long enough to justify a fleet-level management layer |
| Google Cloud is the primary | Assumed | "I'll assume one environment is the centre of gravity; if all three are equal, the design gets more expensive" | Decides where fleet-level control and identity anchor |
| Consistent policy is required everywhere | Assumed | "Otherwise there's no case for a fleet at all and these are three separate platforms" | This is the actual product being bought |
| Workload portability is required for some, not all | Assumed | "Blanket portability is expensive and usually only a subset genuinely needs it" | Prevents designing every workload to the lowest common denominator |
| A platform team exists and operates Kubernetes today | Assumed | "If not, this is the wrong design and the answer is `D5-Q17`" | Fleet management is an operating capability, not a product purchase |

**The answer, out loud**

I'd lead with the product and a confidence caveat, because the naming
here is genuinely a trap in interviews. The platform is **GKE
Enterprise** — that's Google's current branding for the fleet and
multi-environment management layer. **Anthos** is the legacy synonym,
and an interviewer may well still say Anthos. I'd flag that I hold the
rebrand specifics at medium confidence rather than asserting them
flatly: the name and the umbrella framing I'm confident about, the
exact current boundaries of what's included versus licensed
separately I'd want to re-check against the live documentation before
putting it in a design document. Saying that is better than being
crisply wrong, and it's the same caveat this folder carries in
`00-START-HERE/RUNBOOK.md` §7.

With that said, here's what I'd actually design.

The organising concept is the fleet, and a fleet is a set of clusters
that agree to be governed the same way. Registration is the API
boundary: a cluster becomes a member and from that point it receives
fleet-level identity, policy and configuration. Everything I decide
next is a decision about what belongs at fleet level and what stays
local, and that is the whole architecture.

What goes to fleet level. First, identity — fleet Workload Identity,
so a workload's identity is the same concept in all three
environments rather than three unrelated credential schemes. This is
the single highest-value thing the fleet provides, and it's the one
that's hardest to retrofit. Second, policy and configuration
distribution: Config Sync pulling from a git repository as the single
source of truth, with Policy Controller enforcing constraints — so a
policy like "no privileged containers" or "images must come from our
registry with a valid attestation" is written once and enforced in all
three. Third, the service identity and trust that Cloud Service Mesh
needs if we're running one, which is `D5-Q10`'s question and I'd
deliberately keep it separate.

What stays local, and I'd be emphatic about this. Networking is local:
each environment has its own VPC model, its own load balancers, its
own ingress path, its own address space. Storage is local: storage
classes, volume provisioning and performance characteristics differ
per environment and cannot be abstracted honestly. Node management is
local. And critically, the support relationship is local — when a node
misbehaves in one environment, the people you call and the diagnostics
you have are not the same as in another.

So the honest statement of what GKE Enterprise buys is: one control
plane for *policy, identity and configuration*, not one control plane
for everything. Teams that hear "multi-cloud Kubernetes" and conclude
that their application is now environment-agnostic will discover the
difference at the first ingress configuration and the first
persistent volume.

For cluster topology, the axis I'd use is failure domain and
environment, not team and not application. One cluster per environment
per region per tier — production and non-production separated
absolutely, as `D1-Q01`'s hierarchy already requires. Multi-tenancy
inside a cluster is by namespace, with policy enforcing the
boundaries, and I'd resist a cluster-per-team model because it
multiplies the operational surface without changing the blast radius
in the direction anyone wanted.

On portability, I'd be selective and say so. Designing every workload
to run identically in all three means using only the intersection of
what all three offer, which throws away most of the reason to use a
cloud at all. So I'd define a small portable tier — the workloads with
a genuine requirement — and let everything else use the best available
service in its own environment. The portable tier pays a real tax and
it should be a deliberate, named list.

Last, the time dimension, because that's what this file is about. If
the second cloud is transitional, I'd build the minimum: fleet
registration and policy, no mesh across it, no portable tier, and a
decommission date. If it's permanent, the investment is justified, and
I'd still want the list of workloads that genuinely need to be in both
places to be short and re-examined annually, because that list grows
by default and shrinks only on purpose.

**Architecture**

```
  GKE ENTERPRISE FLEET — what is central, what stays local
  ───────────────────────────────────────────────────────
  (GKE Enterprise is the current name; "Anthos" is the legacy
   synonym. MEDIUM confidence on rebrand specifics — verify the
   current package boundaries before this reaches a design doc.)

                  ┌───────────────────────────────────┐
                  │  FLEET (the set of clusters that  │
                  │  agree to be governed the same)   │
                  │  registration = the API boundary  │ ◄─ (1)
                  └──────────────┬────────────────────┘
                                 │
      ┌──────────────────────────┼──────────────────────────┐
      │            CENTRAL — one definition, everywhere      │
      │  ┌────────────────────────────────────────────────┐ │
      │  │ fleet Workload Identity — one identity concept │ │ ◄─ (2)
      │  │ across all three; hardest thing to retrofit    │ │
      │  ├────────────────────────────────────────────────┤ │
      │  │ Config Sync from git = single source of truth  │ │ ◄─ (3)
      │  │ Policy Controller enforces the constraints     │ │
      │  │ ("no privileged containers", "images from our  │ │
      │  │  registry with a valid attestation")           │ │
      │  ├────────────────────────────────────────────────┤ │
      │  │ Cloud Service Mesh identity/trust — only if a  │ │ ◄─ (4)
      │  │ mesh is justified at all (D5-Q10)              │ │
      │  └────────────────────────────────────────────────┘ │
      └──────────────────────────┬──────────────────────────┘
                                 │
   ┌─────────────────┬───────────┴───────────┬─────────────────┐
   ▼                 ▼                       ▼                 │
┌──────────────┐ ┌──────────────────┐ ┌──────────────────┐     │
│ ON-PREM      │ │ GOOGLE CLOUD     │ │ A SECOND CLOUD   │     │
│ clusters     │ │ (primary —       │ │ (transitional or │     │
│              │ │  centre of       │ │  permanent? the  │     │
│              │ │  gravity)        │ │  answer sets the │     │
│              │ │                  │ │  investment) ◄(7)│     │
└──────┬───────┘ └────────┬─────────┘ └────────┬─────────┘     │
       │                  │                    │               │
       ▼                  ▼                    ▼               │
  LOCAL AND NOT ABSTRACTABLE — the honest boundary       ◄─ (5) │
   networking (VPC model, load balancers, ingress, addresses)   │
   storage (classes, provisioning, performance)                 │
   node management                                              │
   the SUPPORT relationship — who you call, what diagnostics    │
   you actually have                                            │
                                                                │
  CLUSTER TOPOLOGY AXIS: failure domain × environment,    ◄─ (6)│
   NOT team and NOT application. Namespaces for tenancy,        │
   policy for the boundaries. prod/non-prod absolutely apart    │
   (D1-Q01's hierarchy already requires it).                    │
                                                                │
  PORTABLE TIER: a short, NAMED list of workloads with a  ◄─ (8)│
   genuine requirement. Everything else uses the best service   │
   in its own environment. The list grows by default and        │
   shrinks only on purpose — re-examine it annually.       ◄─(9)┘
```

**Every arrow explained:**

1. **Registration is the API boundary** — a cluster becomes a fleet
   member and from that moment receives fleet identity, policy and
   configuration. Everything else in this design is a decision about
   what sits above that boundary and what sits below it.
2. **Fleet Workload Identity is the highest-value central piece** —
   one identity concept instead of three unrelated credential schemes,
   and the hardest thing to retrofit once each environment has grown
   its own. Don't defer this; defer the mesh instead.
3. **Config Sync plus Policy Controller** — policy written once in git
   and enforced everywhere. The wrong alternative is configuring each
   cluster individually, which drifts within a quarter and doesn't
   scale past two clusters.
4. **Mesh identity is separate and conditional** — Cloud Service Mesh
   rides on fleet identity but is only worth its operational cost
   under the conditions in `D5-Q10`. Adopting it because the fleet
   supports it is how a platform acquires a control plane nobody
   needed.
5. **The honest boundary: networking, storage, nodes and support stay
   local** — this is the claim the panel is listening for. A fleet
   makes policy and identity uniform; it does not make three
   environments into one, and teams that assume otherwise discover it
   at the first ingress and the first persistent volume.
6. **Cluster topology by failure domain and environment** — not per
   team, not per application. Namespaces plus policy handle tenancy;
   a cluster-per-team model multiplies operational surface without
   improving blast radius. Don't use one shared cluster across
   environments either; the hierarchy in `D1-Q01` already forbids it.
7. **The second cloud's expected lifetime sets the investment** — if
   it's transitional, build registration and policy only, skip the
   mesh and the portable tier, and set a decommission date exactly as
   `D5-Q05` does for the hybrid link.
8. **A short, named portable tier** — designing every workload to the
   intersection of three environments discards most of the value of
   any of them. Portability is a per-workload requirement with a real
   tax, not a platform-wide default.
9. **Re-examine the portable list annually** — it grows by default,
   because "we might need this elsewhere someday" is a cheap thing to
   say and an expensive thing to honour.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Management layer | GKE Enterprise fleet (Anthos, legacy name) | Independently managed clusters per environment | Policy, identity and config defined once; drift across environments is the default failure otherwise | When there is exactly one environment and no on-prem or second-cloud requirement — then plain GKE, or Autopilot, and the fleet layer is unused cost |
| What's centralised | Identity, policy, configuration | Also networking, load balancing and storage | Those four are genuinely local and pretending otherwise produces a leaky abstraction teams trip over | When an environment is being used purely as compute capacity with no local integrations — rare, and usually a transitional state |
| Cluster axis | Failure domain × environment | One cluster per team | Namespaces plus policy already give tenancy; per-team clusters multiply operations without improving isolation | When a team has a genuine regulatory or noisy-neighbour requirement for cluster isolation — then it's an exception with a written reason |
| Portability | A short named tier, everything else uses local services | Design every workload to the common intersection | The intersection is the least capable of the three environments; using it everywhere discards the reason to be in any of them | When a contractual exit requirement covers the whole estate — then the tax is the requirement, and it should be priced and stated |
| Second cloud investment | Sized to its expected lifetime | Build the full platform regardless | A transitional environment shouldn't accumulate permanent machinery | When the second cloud is contractually permanent — then full investment is correct and the end-date discipline moves to the portable list instead |

**Making it concrete**

```hcl
# Membership is the boundary: registration, then fleet-level features.
resource "google_gke_hub_membership" "onprem_cluster" {
  membership_id = "mem-onprem-REGION-01"
  location      = "global"
}

# Policy and config come from git, not from per-cluster configuration.
resource "google_gke_hub_feature_membership" "config_sync" {
  location   = "global"
  feature    = "configmanagement"
  membership = google_gke_hub_membership.onprem_cluster.membership_id

  configmanagement {
    config_sync {
      git {
        sync_repo   = "REPO_URL"
        policy_dir  = "fleet/policy"
        secret_type = "SECRET_TYPE"
      }
    }
  }
}
```

Note what's not in here: no networking, no storage class, no ingress.
Those are per-environment Terraform in per-environment modules, and
keeping them out of the fleet configuration is the design decision,
not an omission.

**What a weak answer sounds like**

- "We'd use Anthos to run everything the same way everywhere." — the
  legacy name plus the overclaim. Networking, storage and ingress are
  not the same everywhere and the answer needs to say which parts are.
- "One big cluster spanning all three environments." — clusters don't
  span environments in any way that survives a partition, and it would
  merge the failure domains the whole design exists to separate.
- "We'd abstract the cloud differences behind our own platform layer."
  — a homegrown abstraction over three environments becomes a
  full-time product with its own roadmap, and it always lags all three
  underlying platforms.
- "Portability means we can leave any cloud whenever we want." — for a
  named, deliberately constrained tier, maybe. For a whole estate with
  managed data services underneath it, the portability claim is
  usually about the compute layer only, and saying so is more credible
  than the blanket version.

**Common wrong turns**

- **Adopting the mesh at the same time as the fleet.** Two control
  planes, one migration, no ability to attribute a problem. Recover by
  sequencing: fleet, policy, identity first; mesh only if `D5-Q10`'s
  conditions hold.
- **Treating the second cloud as symmetric with the primary.** It
  doubles the design for a workload share that is usually small.
  Recover by naming the centre of gravity explicitly and designing
  outward from it.
- **Letting the portable tier become the default.** Every team wants
  optionality until they're told the price. Recover by publishing the
  tax and requiring a named business reason for entry.
- **Registering clusters nobody operates.** A fleet makes badly-run
  clusters consistently badly-run. Recover by fixing single-cluster
  operations first — and if that capability doesn't exist, `D5-Q17`
  is the question you should actually be answering.

**Follow-up probes the interviewer asks next**

1. **"What breaks when the link between on-prem and the fleet's
   control point goes down?"** — running workloads keep running;
   what stops is config reconciliation and new policy distribution.
   That's the correct failure shape and I'd verify it rather than
   assume it, because a design where a WAN outage stops local
   workloads serving is a design with a hidden synchronous dependency.
2. **"Escalate this: someone pushes a bad policy to the git
   repository. What's the blast radius?"** — every cluster in the
   fleet, in all three environments, which is the price of defining
   policy once. So the repository needs the same change controls as
   production itself — review, a staged rollout across fleet scopes
   rather than all at once, and an ability to revert that doesn't
   require the pipeline that just broke. Centralised policy without
   staged rollout is a single point of estate-wide failure.
3. **"Who owns the fleet — the platform team, or each environment's
   team?"** — the platform team owns fleet-level policy and identity;
   environment teams own their local layer. The organisational failure
   is a shared-ownership model where nobody can say no to a policy
   exception, and within a year the fleet's constraints are a set of
   per-cluster overrides that prove nothing.
4. **"How do you stop fleet policy from becoming a bottleneck for
   forty teams?"** — the same way `D1-Q06` and `D1-Q11` handle it:
   most constraints advisory or detective rather than blocking, a
   defined exception path with expiry, and policy changes shipped by
   teams through review rather than requested from a queue.
5. **"Would you still do this if the second cloud disappeared?"** —
   yes, for on-prem plus Google Cloud, because the policy and identity
   consistency argument holds with two environments. I would not do it
   for a single-environment estate; that's plain GKE and the fleet
   layer would be paying for a capability with no second member.
6. **"What's the first thing you'd measure?"** — the number of
   policy exceptions per environment. If one environment accumulates
   most of them, the fleet isn't delivering consistency there and it's
   worth finding out whether that's a technical gap or a team that
   never agreed to the model in the first place.

**Cross-references**

- `01-domains/DOMAIN-1-designing-planning.md` §"Hybrid connectivity
  and GKE Enterprise" — the when-it's-the-answer / when-it's-overkill
  matrix; not restated here.
- `00-START-HERE/RUNBOOK.md` §7 — the Anthos-to-GKE-Enterprise naming
  correction and its MEDIUM-confidence caveat.
- `D5-Q10` for the mesh decision, `D5-Q17` for whether Kubernetes is
  the right substrate at all, `D5-Q05` for the connectivity underneath.
- `01-domains/DOMAIN-2-managing-provisioning.md` — fleet registration
  and Config Sync as a provisioning concern.

---

### D5-Q10 — "Where does a service mesh actually earn its operational cost, and where is it pure overhead?"

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 2.1, 5.1 |
| **Axis** | time |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D5-Q09` |

**What the interviewer is actually testing**

Whether you'll give a threshold rather than a preference. A mesh is a
second control plane in the request path, and the question is entirely
about when that cost is repaid. The migration-specific angle is the
one candidates miss: a mesh's traffic-shifting capability is exactly
the machinery a strangler-fig cutover needs, which makes an in-flight
migration one of the better reasons to adopt one — and a completed
migration one of the better reasons to reconsider.

**Clarifying questions to ask before drawing anything**

- **How many services are there, and how many teams own them?**
  Under roughly ten services owned by one team, a shared library does
  everything a mesh would and costs a fraction. The count and the team
  boundary both matter.
- **Is mutual TLS between services a stated compliance requirement?**
  If it is, and if the services are heterogeneous enough that
  per-application TLS is impractical, that single requirement can
  justify a mesh on its own.
- **How many languages and frameworks are in play?** One language
  means a library is viable. Five, including things nobody maintains,
  means the sidecar model is doing work you genuinely cannot do in the
  applications.
- **Is there a migration in flight that needs traffic shifting?**
  Canary, mirror and per-header routing as platform capabilities are
  exactly `D5-Q04`'s requirements, and getting them from the platform
  rather than building them per application changes the calculation.
- **Who operates the mesh at 3am, and have they operated one before?**
  This is the question that decides it. A mesh nobody can debug during
  an incident is a liability that only shows up on the worst night.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Service count and ownership spread | Assumed | "I'd want the actual numbers — under ten services and one team, my answer is no" | The threshold is the answer |
| Mutual TLS between services required | Assumed | "If it's a compliance requirement rather than a preference, that changes the weighting a lot" | Can justify a mesh by itself |
| Heterogeneous languages/frameworks | Assumed | "If it's all one stack, a library is cheaper and easier to debug" | Decides library versus sidecar |
| A migration needing traffic shifting is in flight | Assumed | "If so, the mesh is buying cutover machinery, not just observability" | The strongest time-bounded justification |
| A platform team can operate a second control plane | Stated by me | "If nobody can debug it at 3am, this is a no regardless of the other four" | Operational capacity is the veto |

**The answer, out loud**

I'd give a threshold rather than an opinion, because that's what makes
this answerable.

A mesh earns its cost when three things are true at once. First, there
are enough services and enough owning teams that per-application
implementation of the same cross-cutting concerns is genuinely
duplicated work — in practice somewhere north of fifteen or twenty
services across several teams, though the team count matters more than
the service count. Second, the applications are heterogeneous enough
that you cannot solve it with a library: multiple languages, or
applications you don't control the source of, which is common in a
migration. Third, there's an operating capability to run it. That
third one is a veto, not a factor.

Given those, what the mesh actually buys is four things. Mutual TLS
between services without touching application code, which is the
cleanest case and often the compliance-driven one. Consistent
retries, timeouts and circuit breaking applied uniformly rather than
implemented five different ways. L7 telemetry from applications that
were never instrumented — which in a migration is enormously valuable,
because the legacy applications you're moving have no useful
instrumentation and you can't add any. And traffic management as a
platform capability: weighted routing, mirroring, per-header routing.

That last one is why I'd raise a mesh specifically in a migration
context. Everything `D5-Q04` needs — shadow traffic, percentage
splits, per-entity routing — is mesh functionality. If a team is
building that machinery per application for a dozen cutovers, a mesh
is cheaper and more consistent. Cloud Service Mesh is the managed
route, and on a fleet it rides the identity the fleet already provides
(`D5-Q09`), which removes most of the setup cost that made meshes
painful historically.

Now where it's pure overhead, and I'd be just as specific. Under about
ten services with one owning team and one language: a library does all
four of the things above, is debuggable with an ordinary stack trace,
and adds no hops. A small estate where the real problem is that
nobody has set timeouts: a mesh will let you set them centrally and
will not tell you what they should be, so you've bought a control
plane to solve a configuration problem. And any team without the
capacity to operate it — because the cost isn't the installation, it's
the upgrades, the version skew, and the incident where the question
"is it the app or the sidecar" takes forty minutes to answer.

The cost is worth stating plainly rather than minimising. Resource
overhead per workload. An extra component in every request path, which
means an extra failure mode and an extra thing to upgrade. Debugging
that now has two hops where it had one. And a version-coupling problem
between the mesh and the platform underneath it that becomes a
standing upgrade obligation.

On boundaries, which is the other half of the question. A mesh belongs
*inside* a trust domain, and a gateway belongs *at the edge* of one. I
would not extend the mesh across the on-prem boundary during a
migration just because the fleet makes it possible — the WAN is its
own failure domain with its own latency profile, and putting mesh
semantics across it means a network event becomes a mesh event. The
right shape is a mesh on each side and a gateway between them, so the
cross-boundary path has explicit, coarse-grained semantics that
somebody chose.

And the time dimension: if the mesh is adopted mainly for migration
traffic management, I'd say out loud at adoption time that it should
be re-justified when the migration completes. Not necessarily removed
— the mTLS and telemetry arguments may still hold — but re-justified,
because a control plane adopted for a reason that has expired is how
platforms accumulate permanent complexity.

**Architecture**

```
  DOES A MESH EARN ITS COST? — a threshold, not a preference
  ─────────────────────────────────────────────────────────

   ┌──────────────────────────────────────────────────────────┐
   │ VETO GATE — can a team operate a second control plane    │
   │ at 3am, and have they before?                            │
   │   NO ──▶ STOP. The answer is no regardless of everything │
   │          below. A mesh nobody can debug is a liability   │
   │          that appears on the worst night.        ◄─ (1)  │
   └───────────────────────────┬──────────────────────────────┘
                          YES  ▼
   ┌──────────────────────────────────────────────────────────┐
   │ SCALE TEST — services and, more importantly, owning teams│
   │   < ~10 services, one team, one language                 │
   │        ──▶ LIBRARY. Same four capabilities, no extra hop,│
   │            debuggable with an ordinary stack trace ◄─(2) │
   │   > ~15-20 services across several teams  ──▶ continue   │
   └───────────────────────────┬──────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────┐
   │ HETEROGENEITY TEST — multiple languages, or applications │
   │ whose source you do not control (common in a migration)  │
   │   homogeneous ──▶ LIBRARY still wins              ◄─(3)  │
   └───────────────────────────┬──────────────────────────────┘
                               ▼
             WHAT THE MESH THEN BUYS — four things
   ┌──────────────────────────────────────────────────────────┐
   │ a. mTLS between services, no application change    ◄─(4) │
   │ b. uniform retries / timeouts / circuit breaking         │
   │ c. L7 telemetry from UNINSTRUMENTED legacy apps    ◄─(5) │
   │ d. traffic management as a PLATFORM capability:          │
   │    weighted routing, mirroring, per-header routing ◄─(6) │
   │    — which is exactly D5-Q04's cutover machinery         │
   └───────────────────────────┬──────────────────────────────┘
                               ▼
             BOUNDARY PLACEMENT
   ┌──────────────────────────────────────────────────────────┐
   │  mesh INSIDE a trust domain    gateway AT its edge  ◄─(7)│
   │                                                          │
   │  ┌──────────────┐        ┌──────────────┐                │
   │  │ on-prem mesh │◄──────▶│ cloud mesh   │                │
   │  └──────┬───────┘  GW    └──────┬───────┘                │
   │         └──── WAN is its own failure domain — do NOT     │
   │               stretch mesh semantics across it     ◄─(8) │
   └───────────────────────────┬──────────────────────────────┘
                               ▼
   RE-JUSTIFY WHEN THE MIGRATION ENDS                   ◄─ (9)
    adopted for cutover machinery? that reason expires. mTLS and
    telemetry may still hold — but make it a decision, not drift.
```

**Every arrow explained:**

1. **Operating capacity is a veto, not a factor** — the cost of a mesh
   isn't installation, it's upgrades, version skew, and the incident
   where "app or sidecar" takes forty minutes to answer. No capacity,
   no mesh, whatever the other arguments say.
2. **Under the scale threshold, use a library** — same four
   capabilities, no extra hop, and a failure that shows up in an
   ordinary stack trace. Don't use a mesh when one team owns
   everything in one language; the control plane is solving a problem
   that doesn't exist yet.
3. **Heterogeneity is what a library cannot cross** — multiple
   languages, or applications whose source you don't control. A
   migration produces exactly this condition, which is why the
   question arises during migrations more than at any other time.
4. **mTLS without application change** — the cleanest justification
   and usually the compliance-driven one. Don't reach for a mesh for
   this alone if a small homogeneous estate can do TLS in a shared
   library.
5. **L7 telemetry from uninstrumented legacy applications** — you
   cannot add instrumentation to the systems you're migrating, and
   during coexistence this is often the only usable signal about what
   the legacy path is doing.
6. **Traffic management as a platform capability** — weighted
   routing, mirroring and per-header routing are `D5-Q04`'s
   requirements. Building that per application across a dozen cutovers
   costs more and is less consistent than getting it from the platform.
7. **Mesh inside a trust domain, gateway at the edge** — coarse,
   explicit semantics at the boundary rather than fine-grained mesh
   behaviour stretched across it.
8. **Do not stretch the mesh across the WAN** — the hybrid link is its
   own failure domain with its own latency profile; mesh semantics
   across it turn a network event into a mesh event, which is harder
   to diagnose and harder to bound.
9. **Re-justify at the end of the migration** — a control plane
   adopted for a reason that has expired is how platforms accumulate
   permanent complexity. The decision may well be "keep it," and it
   should still be a decision.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Below the scale threshold | Shared library for cross-cutting concerns | Service mesh | No extra hop, no second control plane, failures appear in ordinary stack traces | When even a small estate has applications you can't modify — a migration with vendor binaries, where the sidecar is the only place to put the behaviour |
| Above the threshold | Managed mesh (Cloud Service Mesh) | Self-operated open-source mesh | The control plane is the part that consumes a team; managed removes most of that | When a specific extension or version is required that the managed option doesn't support, and the team genuinely has the capacity to run it |
| Cross-boundary traffic | Gateway between two meshes | One mesh stretched across the WAN | Keeps the WAN as an explicit, coarse-grained boundary rather than an implicit mesh hop | When both "sides" are actually in the same low-latency failure domain — two clusters in one region, say, where the boundary is administrative rather than physical |
| Adoption timing | Adopt during the migration, for its traffic machinery | Adopt after the migration, when the estate is settled | The cutover machinery is needed exactly while the migration is running | When the migration is a small number of cutovers — then per-application traffic splitting is cheaper than a platform-wide adoption |
| Post-migration | Re-justify explicitly | Keep it because it's there | Prevents permanent complexity inherited from an expired reason | When mTLS or telemetry are themselves standing requirements — then the re-justification passes and that's the correct outcome |

**What a weak answer sounds like**

- "A mesh gives you observability, security and traffic management."
  — a feature list, not a threshold. The question asked where it
  earns its cost, and a list doesn't answer that.
- "Every microservice architecture should have a mesh." — this
  installs a second control plane into estates with six services and
  one team, where a library does the same job with less to debug.
- "We'd mesh across on-prem and cloud so everything is uniform." —
  attractive and wrong. The WAN's failure characteristics are
  different, and stretching mesh semantics across it makes network
  incidents present as mesh incidents.
- "The sidecar overhead is negligible." — it isn't negligible, it's
  acceptable under certain conditions, and the honest version of that
  sentence is what a panel is listening for.

**Common wrong turns**

- **Adopting the mesh in the same change as the platform.** Two new
  control planes, one blast radius. Recover by sequencing: the
  platform first, the mesh only when the conditions hold.
- **Using the mesh to fix missing timeouts.** It centralises where the
  timeouts are configured and tells you nothing about what they should
  be. Recover by setting the values first, then deciding whether
  central configuration is worth a control plane.
- **Meshing everything including batch and jobs.** Sidecars around
  short-lived jobs introduce lifecycle problems that consume more time
  than the mesh saves there. Recover by scoping the mesh to the
  request-serving tier.
- **Never revisiting the decision.** Adopted for a migration, kept
  forever, justified by nothing anyone can articulate. Recover by
  writing the re-justification date into the adoption decision itself.

**Follow-up probes the interviewer asks next**

1. **"Latency went up after adoption. Is that the mesh?"** — probably
   partly, and the way to know is a measured baseline taken before
   adoption, which is why I'd insist on capturing one. If no baseline
   exists, the argument is unwinnable and the mesh gets blamed for
   everything for the next year.
2. **"Escalate this: the mesh control plane fails. What happens to
   traffic?"** — existing proxies should keep serving with their last
   configuration, so running traffic continues and what stops is
   configuration change. I'd verify that behaviour explicitly rather
   than trust it, because the failure mode where a control plane
   outage becomes a data plane outage is the single worst property a
   mesh can have and it's worth testing deliberately.
3. **"A team wants to opt out of the mesh. Do you let them?"** — yes,
   with a written reason and a plan for how they meet the requirements
   the mesh was providing. A mandatory mesh with no exit is an
   organisational fight that the platform team loses slowly; an opt-out
   with conditions is one they can hold.
4. **"How would you roll it out across forty teams?"** — namespace by
   namespace, starting with teams that want it, with permissive mode
   before enforcement so that mTLS doesn't break traffic during
   adoption. The organisational point is that early adopters should be
   volunteers; mandating it first makes every subsequent problem a
   political one.
5. **"When would you remove one?"** — when the estate consolidated
   back to one team and one language, or when the migration that
   justified the traffic machinery finished and the mTLS requirement
   turned out to be a preference. Removal is rare and I'd rather the
   option stay live than pretend it's irreversible.
6. **"Does your answer change on a fleet across three
   environments?"** — the identity groundwork is already there from
   `D5-Q09`, which lowers adoption cost meaningfully. It does not
   lower operating cost, and operating cost was the veto, so the
   answer changes at the margin and not at the threshold.

**Cross-references**

- `D5-Q09` for the fleet identity a managed mesh rides on; `D5-Q04`
  for the cutover machinery that is the strongest time-bounded reason
  to adopt one.
- `D5-Q11` for the edge gateway that belongs at the trust boundary
  rather than inside it.
- `03-comparisons/03-networking-connectivity.md` for the load-balancer
  and private-access mechanisms the mesh sits above, not instead of.

---

### D5-Q11 — "Half of this estate is a mainframe and two vendor systems we are contractually forbidden from modifying. Put an API layer in front of them."

| | |
|---|---|
| **Band** | Staff |
| **Primary domain leaves** | 1.4, 2.1 |
| **Axis** | time |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D5-Q04` |

**What the interviewer is actually testing**

Whether you know what the façade is actually for. Candidates reach for
rate limiting and developer portals; the architectural value is that
the façade is where you buy the ability to replace the backend later
without every consumer noticing. The second signal is whether you'll
expose your own domain model or the mainframe's field names, because
the second choice exports the legacy schema into every new consumer
permanently.

**Clarifying questions to ask before drawing anything**

- **Who consumes these APIs — our own teams, partners, or the public?**
  Internal-only consumers need much less than partner or public ones,
  and the difference decides whether this is an API management product
  or a routing layer.
- **What protocols do the backends actually speak?** If it's a
  message-queue interface or a fixed-width record format over a
  proprietary transport, most of the work is protocol adaptation and
  the API management layer is the smaller half.
- **What is the transaction budget on the mainframe?** These systems
  usually have a hard, purchased capacity. If so, caching and
  admission control aren't optimisations, they're the design.
- **Is anything about these systems going to change?** If one of the
  vendor systems is being replaced in two years, the façade's job is
  to make that replacement invisible, and that shapes the interface
  design now.
- **Do the backends support idempotency or retries?** Usually not. If
  not, the adapter has to provide it, and that's a stateful component
  with its own storage — not a thin proxy.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Backends cannot be modified | Stated | — | All adaptation happens outside them, in a layer we own |
| Mainframe has a fixed transaction budget | Assumed | "These systems almost always do; if we exceed it the cost is contractual, not elastic" | Makes caching and admission control structural, not optional |
| Backends are not idempotent | Assumed | "I'll assume no retry safety; if they have it, the adapter gets much simpler" | Adapter becomes stateful, with its own store |
| At least one backend will be replaced eventually | Assumed | "Designing as if all three are permanent throws away the façade's main value" | Interface must expose our model, not theirs |
| Consumers include teams outside our own | Assumed | "If it's genuinely internal-only, I'd scale the API management piece down sharply" | Decides Apigee versus a thinner front |

**The answer, out loud**

I'd start by naming what this layer is for, because it changes the
design. It is not primarily a rate limiter and it is not primarily a
developer portal. It is the seam that lets us replace a backend
without every consumer rewriting. Everything else is secondary, and if
we design it for the secondary purposes we'll get the primary one
wrong.

That has one immediate consequence: the interface exposes our domain
model, not the mainframe's. If the façade's response contains
fixed-width codes and field names from a 1990s copybook, we have taken
the legacy schema and published it to every future consumer, and in
five years the mainframe is gone but its data model is in forty
applications. So the layer is an anti-corruption layer: our
vocabulary, our resource shapes, our error semantics, and a mapping
inside it that is allowed to be ugly because it is contained.

Then the technology choice, and I'd make it on consumer profile rather
than on features. Apigee is the answer when there are consumers we
don't control — partners, external developers, other business units
with their own release cycles — because what we're buying is the
governance surface: versioning, per-consumer quotas and keys,
lifecycle, a portal, and the policy layer that lets us change backend
behaviour without touching consumers. API Gateway is the answer when
we need a managed front for a handful of backends with no governance
model around it — a thinner, cheaper option that does the routing and
the authentication and stops there. And if the work is genuinely
protocol translation with no API management need at all, the honest
answer is a load balancer in front of adapter services, and I'd say
so rather than buying a product to justify the architecture. Don't use
Apigee for two internal services calling each other; that's
`D5-Q10`'s territory and a gateway there is a hop with a bill
attached.

The adapters are where the real engineering is. Each backend gets its
own adapter service — I'd run them as containers — and the adapter
owns three things the backend cannot. Protocol translation, which is
the obvious one. Idempotency, which is the important one: the adapter
keeps a store of client-supplied request identifiers with their
outcomes, so a retry returns the original result rather than
submitting a second transaction to a mainframe that will happily
process it twice. And a circuit breaker with a bounded queue, so that
when the backend slows, the façade sheds load deliberately instead of
letting a thousand pending requests pile up against a system with a
fixed transaction budget.

Caching deserves its own mention because of that budget. If the
mainframe has a purchased transaction capacity, a cache in front of
read paths isn't a performance optimisation, it's the thing that makes
the whole design affordable. I'd want explicit cache semantics per
resource — what's cacheable, for how long, and how it's invalidated —
agreed with the business owner rather than chosen by a developer,
because the acceptable staleness is a business question.

On the time dimension, which is why this question is in this file: the
façade is also the cutover mechanism. Once every consumer goes
through it, replacing a vendor system becomes exactly the `D5-Q04`
sequence — shadow the new backend, compare, ramp reads, flip write
authority — with no consumer changes at all. That's the payoff and
it's worth building for even if no replacement is scheduled yet,
because the alternative is that each of the three systems becomes
permanently unreplaceable as consumers accumulate direct dependencies.

What I'd flag as the risk: a façade in front of an unmodifiable
backend can become a place where business logic accretes. Somebody
needs a field the mainframe doesn't return, so the adapter computes
it; then someone needs a rule applied, so the adapter applies it. Two
years later the adapter is a second application with no tests and no
owner. I'd put an explicit rule around it — the adapter translates and
protects, it does not decide — and I'd expect to enforce that in
review rather than by hoping.

**Architecture**

```
   consumers: our teams │ partner systems │ other business units
                        └────────┬────────┘
                                 ▼
   ┌──────────────────────────────────────────────────────────┐
   │  FAÇADE — its purpose is REPLACEABILITY, not throttling  │
   │                                                    ◄─(1) │
   │  Apigee        when consumers we don't control exist:    │
   │                versioning, per-consumer keys and quota,  │
   │                lifecycle, portal, policy layer     ◄─(2) │
   │  API Gateway   thin managed front, few backends, no      │
   │                governance model needed             ◄─(3) │
   │  LB + adapters when it is pure protocol translation and  │
   │                no API management is needed at all  ◄─(4) │
   │                                                          │
   │  PUBLISHES OUR DOMAIN MODEL — never copybook field names │
   │  anti-corruption layer: the ugly mapping is CONTAINED ◄(5)│
   └───────────────────────────┬──────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────┐
   │  READ CACHE — with the mainframe's fixed transaction     │
   │  budget, this is structural, not an optimisation.   ◄─(6)│
   │  Cacheability and staleness agreed with the BUSINESS     │
   │  owner per resource, not chosen by a developer.          │
   └───────────────────────────┬──────────────────────────────┘
                               ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ ADAPTER      │  │ ADAPTER      │  │ ADAPTER      │
   │ mainframe    │  │ vendor sys A │  │ vendor sys B │
   │              │  │              │  │              │
   │ owns three   │  │              │  │              │
   │ things the   │  │              │  │              │
   │ backend      │  │              │  │              │
   │ cannot:      │  │              │  │              │
   │ a. protocol  │  │              │  │              │
   │    translation│ │              │  │              │
   │ b. IDEMPOTENCY│ │              │  │              │
   │    store of   │ │              │  │              │
   │    client req │ │              │  │              │
   │    ids + out- │ │              │  │              │
   │    comes ◄(7) │ │              │  │              │
   │ c. circuit    │ │              │  │              │
   │    breaker +  │ │              │  │              │
   │    bounded    │ │              │  │              │
   │    queue ◄(8) │ │              │  │              │
   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
          ▼                 ▼                 ▼
     MAINFRAME        VENDOR SYS A       VENDOR SYS B
     (unmodifiable)   (unmodifiable)     (unmodifiable)

  THE PAYOFF: once every consumer goes through the façade,      ◄─(9)
  replacing a backend is exactly D5-Q04 — shadow, compare, ramp
  reads, flip write authority — with ZERO consumer changes.

  THE RISK, stated as a rule: the adapter TRANSLATES and
  PROTECTS. It does not DECIDE. Business logic accreting in an
  adapter produces a second application with no tests and no owner.
```

**Every arrow explained:**

1. **The façade's purpose is replaceability** — throttling and portals
   are secondary. Designing for the secondary purposes produces an
   interface shaped like the backend, which forfeits the primary one.
2. **Apigee when consumers are outside our control** — the governance
   surface (versioning, per-consumer keys and quota, lifecycle,
   portal, policy) is what's being bought. Don't use it for two
   internal services talking to each other; that's a mesh question
   (`D5-Q10`) and a gateway there is a hop with a bill attached.
3. **API Gateway for a thin managed front** — a handful of backends,
   authentication and routing, no governance model. Cheaper and
   simpler; don't use it when per-consumer lifecycle and quota
   management are real requirements.
4. **Load balancer plus adapters when it's pure protocol work** — if
   there's no API management requirement, say so rather than buying a
   product to justify the architecture.
5. **Anti-corruption layer, publishing our domain model** — the ugly
   mapping is contained inside the adapter. Publishing copybook field
   names exports the legacy schema into every future consumer, and it
   outlives the mainframe by years.
6. **The read cache is structural** — against a fixed, purchased
   transaction budget it's what makes the design affordable.
   Cacheability and acceptable staleness are business decisions per
   resource, because the cost of stale data lands on the business.
7. **Idempotency lives in the adapter** — a store of client-supplied
   request identifiers and their outcomes, so a retry returns the
   original result rather than submitting a second transaction to a
   system that will cheerfully process it twice. This makes the
   adapter stateful, which is a deliberate design choice, not an
   accident.
8. **Circuit breaker with a bounded queue** — when the backend slows,
   shed load deliberately. An unbounded queue against a
   fixed-capacity backend converts slowness into a total outage plus
   a contractual overage.
9. **The payoff is the cutover** — with every consumer behind the
   façade, replacing a backend is the `D5-Q04` sequence with no
   consumer changes. Worth building before a replacement is scheduled,
   because otherwise each system becomes permanently unreplaceable as
   direct dependencies accumulate.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Façade technology | Apigee, given consumers outside our control | API Gateway | Versioning, per-consumer quota and lifecycle are the requirement, not just routing | When every consumer is our own team on our own release cadence — then API Gateway does the job at a fraction of the operating model |
| Interface vocabulary | Our domain model | The backend's existing field names and codes | Publishing the legacy schema exports it to every consumer permanently | When the backend's model genuinely *is* the domain model — occasionally true for a well-designed vendor system, and worth checking rather than assuming |
| Idempotency | In the adapter, with its own state store | Rely on consumers not to retry | Consumers will retry, networks will time out, and the mainframe will process twice | When the backend natively supports idempotent submission — then use it and keep the adapter stateless |
| Read path | Cache with business-agreed staleness | Pass every read through to the backend | A fixed transaction budget makes pass-through the expensive and fragile option | When the data cannot be stale at all (a balance or an authorisation) — then pass through and size the budget for it explicitly |
| Adapter scope | Translate and protect only | Let adapters compute and apply business rules | Logic in an adapter becomes a second application with no tests and no owner | When the rule genuinely belongs to the integration itself — a protocol-level default or a format conversion — which is a narrow and nameable set |

**What a weak answer sounds like**

- "We'd put an API gateway in front and expose the existing
  operations." — that publishes the mainframe's model. The gateway is
  present and the architectural work hasn't happened.
- "Apigee gives us rate limiting and analytics." — true and beside the
  point. The panel asked about a legacy estate; the value is
  replaceability, and rate limiting is a feature of the thing that
  delivers it.
- "The adapters will be simple pass-through proxies." — not against a
  non-idempotent backend with a fixed transaction budget. Idempotency
  and admission control make the adapter stateful, and pretending
  otherwise is how a retry storm becomes a duplicate-transaction
  incident.
- "We'd cache aggressively to protect the mainframe." — right
  instinct, missing the part where acceptable staleness is a business
  decision per resource, not a uniform time-to-live chosen by whoever
  wrote the adapter.

**Common wrong turns**

- **Designing the interface from the backend outward.** It's the path
  of least resistance and it produces a published legacy schema.
  Recover by designing the resource model from consumer use cases
  first and treating the mapping as the adapter's problem.
- **Making the façade a smart layer.** Every unmet need becomes a
  small piece of logic in the adapter. Recover by writing the
  translate-and-protect rule down and enforcing it in review.
- **Ignoring the transaction budget until it's exceeded.** It's a
  contractual cost, not an elastic one. Recover by making admission
  control and caching part of the initial design, not a later
  optimisation.
- **Treating all three backends the same.** The mainframe and two
  vendor systems have different constraints, different failure modes
  and different replacement horizons. Recover by giving each its own
  adapter with its own policies rather than a shared integration layer.

**Follow-up probes the interviewer asks next**

1. **"A consumer needs a field the mainframe doesn't have. What do you
   do?"** — find out who owns that data. If another system has it, the
   composition belongs in a service above the façade, not in the
   adapter. If nobody has it, it's a product decision about deriving
   it, and it still doesn't belong in the adapter. This is exactly the
   pressure that erodes the translate-and-protect rule.
2. **"Escalate this: the façade itself goes down. What's the blast
   radius?"** — every consumer of all three backends at once, which is
   the price of the seam. So it needs redundancy at least equal to the
   backends it fronts, and I'd want to know whether any consumer has a
   legitimate emergency direct path — usually one does, usually
   undocumented, and finding it before an incident is worth doing
   deliberately.
3. **"Vendor system A is being replaced next year. Does the façade
   help or hurt?"** — helps decisively, and it's the reason to build
   it. The replacement becomes the `D5-Q04` sequence behind an
   unchanged interface, and consumers find out from a release note
   rather than from a migration project.
4. **"Who owns the adapters — the platform team or the teams that
   consume them?"** — a small integration team that owns all three,
   because the knowledge is backend-specific and consumer teams
   shouldn't need it. The organisational risk is this team becoming a
   ticket queue for every new field; the mitigation is that the
   interface is a product with a roadmap, not a request channel.
5. **"The mainframe team says the façade adds latency."** — it does,
   and the honest response is a number rather than a denial. Then the
   counter-argument is what it buys: the caching that reduces their
   transaction load, and the admission control that stops a consumer
   bug from consuming their budget. Those are benefits to them, and
   framing them that way is usually more productive than defending the
   architecture.
6. **"Would you build this if no backend replacement were planned?"**
   — yes, and I'd say why explicitly: without it, each system becomes
   less replaceable every quarter as direct dependencies accumulate.
   The façade is cheapest to install before anyone needs it and most
   expensive after everyone has wired around it.

**Cross-references**

- `D5-Q04` for the cutover sequence the façade enables; `D5-Q10` for
  why a gateway belongs at a trust boundary and a mesh inside one.
- `D5-Q16` for the rehost-landing version of "make it replaceable
  later"; `D5-Q12` for when the right answer is to replace the vendor
  system with SaaS rather than front it.
- `01-domains/DOMAIN-5-managing-implementation.md` — Apigee's
  positioning in the implementation-management material.

---
### D5-Q12 — "Our internal claims-handling system is twenty years old. A vendor's SaaS covers most of what it does. Do we buy it or rebuild it?"

| | |
|---|---|
| **Band** | Principal |
| **Primary domain leaves** | 1.1, 1.4 |
| **Axis** | time |
| **Whiteboard time** | 35–45 min |
| **Reads well after** | `D5-Q01`, `D1-Q17` |

**What the interviewer is actually testing**

Whether you can make this decision on the differentiation axis rather
than the feature axis, and whether you'll commit to an answer. The
secondary test is honesty about what "we need our customisations"
usually means. Twenty years of accumulated exceptions is not the same
thing as differentiating capability, and a Principal-band answer
separates them out loud.

**Clarifying questions to ask before drawing anything**

- **Does this system differentiate us, or is it table stakes?** Does a
  customer ever choose us because of how this works? If the honest
  answer is no, the decision is mostly made and the rest is execution.
- **Which of our customisations are actually used, and by how many
  people?** Usage data, not opinions. In my experience a large share
  of "essential" customisation is used by a handful of people once a
  quarter and exists because someone asked for it in 2011.
- **What's the real gap between the SaaS and what we do — capability,
  or process?** A capability gap is a hard constraint. A process gap
  means we'd have to work differently, which is a change-management
  cost and usually a smaller one than people assume.
- **Who would own the rebuild, and do they exist today?** A rebuild
  needs a standing product team for years, not a project team for
  eighteen months. If that team doesn't exist and won't be funded,
  rebuild isn't actually on the table.
- **What does the data exit look like from the SaaS?** Not whether
  they have an export — whether the export is in a shape we could
  operate from if we had to leave. That's the question that bounds the
  downside.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| The system is internally facing | Stated | — | Differentiation is far less likely than for a customer-facing system |
| The SaaS covers most of the functionality | Stated | — | Makes the decision about the residue, not the bulk |
| Some customisations are genuinely load-bearing | Assumed | "I'd expect a small number to be real and most to be accumulated exceptions — and I'd want usage data rather than a survey" | The size of that set is the deciding input |
| No standing product team exists for a rebuild | Assumed | "If we can't staff it permanently, rebuild is a project that becomes a legacy system in five years" | Removes rebuild from the table where it's true |
| Integration with surrounding systems is required | Assumed | "Whichever way we go, the integration work is comparable and shouldn't decide it" | Neutralises a common false argument |
| Data must be extractable in a usable shape | Stated by me | "I'd make this a contractual condition, demonstrated rather than asserted" | Bounds the downside of the buy path |

**The answer, out loud**

I'd answer on one axis and I'd name it first: does this system make us
different from our competitors in a way a customer would notice? For
an internal claims-handling system the honest answer is usually no —
what differentiates an insurer is pricing, underwriting judgement and
service, and the claims system is the machinery those run on. If
that's right, the default is repurchase, and the burden of proof sits
with rebuild rather than the other way round.

But I'd apply a test before accepting that, because the differentiating
capability sometimes *is* hiding in the machinery. I'd take the actual
usage data and separate three things. One: capabilities that are
genuinely ours, used constantly, and that the SaaS cannot do — this is
usually a short list and sometimes empty. Two: capabilities the SaaS
does differently, where adopting it means our people work differently.
Three: accumulated exceptions — the field somebody added in 2011, the
report three people run, the workflow variant for a product line we
discontinued. Most organisations put all three in one bucket called
"our customisations" and then conclude the SaaS can't do what they
need.

If bucket one is empty or nearly so, repurchase. If bucket two is
large, repurchase is still probably right but the project is a change
programme, not a technology one, and I'd size it that way — the
failure mode of a repurchase is never the software, it's users who
were never brought along and route around it. If bucket one is
genuinely substantial and genuinely differentiating, then refactor in
house, and the SaaS is at best a component behind our own interface.

Now the cost side, and I'd frame it as structure and risk ownership
rather than as a comparison of totals, because the totals are usually
constructed to support whichever answer the sponsor already wants.

Buying converts a capability into an ongoing operating commitment.
Someone else absorbs the run risk, the patching, the availability, the
capability roadmap. We absorb three risks in exchange: integration
risk, because the SaaS has to talk to everything around it and that
work is ours; data-portability risk, because our operational history
now lives in their model; and roadmap risk, because their priorities
are set by their whole customer base and not by us. The shape of the
commitment is that it's smaller than building, more predictable, and
the floor is higher — we can't get it cheaper by being clever, and we
can't stop paying without a migration.

Building keeps all the risk and all the optionality. We own the
roadmap, we own the data, and we own every incident, every dependency
upgrade and every departure of the person who understood the
reconciliation logic. The cost is front-loaded and the tail is
unbounded — a system like this doesn't finish, it just enters
maintenance, and maintenance of an internal system with no external
pressure is where organisations quietly accumulate the next twenty-
year-old system.

That asymmetry is the actual decision content. Buying caps the
downside and caps the upside. Building does the opposite. For a
capability that doesn't differentiate us, capping both is exactly the
right trade, because there is no upside to capture.

So I'd commit: repurchase, with four conditions. The data export must
be demonstrated, not described — we extract a real dataset and confirm
it's in a shape we could operate from. The integration is built to our
domain model behind an anti-corruption layer (`D5-Q11`), so the SaaS
vendor's model doesn't propagate into every surrounding system and
make a future change impossible. A named business owner runs the
process-change work, and it's resourced as the larger half of the
project. And we keep an inventory of bucket-one capabilities with an
explicit decision for each — adopted, dropped, or built alongside —
rather than discovering them during user acceptance testing.

The one thing I'd refuse is the middle path where we buy the SaaS and
then customise it heavily to match what we do today. That gets the
cost structure of buying, the change cost of building, and an upgrade
path that breaks every release. If the answer is "we'd need to
customise it substantially," that's evidence for rebuild, not a plan
for buying.

**Architecture**

```
  DECISION FLOW — one axis, then a test, then conditions
  ─────────────────────────────────────────────────────

   ┌────────────────────────────────────────────────────────────┐
   │ THE AXIS: does this make us different in a way a CUSTOMER  │
   │ would notice?                                        ◄─(1) │
   │   internal claims handling → almost always NO              │
   │   → default is REPURCHASE; burden of proof sits on rebuild │
   └───────────────────────────┬────────────────────────────────┘
                               ▼
   ┌────────────────────────────────────────────────────────────┐
   │ THE TEST — split "our customisations" using USAGE DATA,    │
   │ not a survey of opinions                             ◄─(2) │
   │                                                            │
   │  bucket 1  genuinely ours, used constantly, SaaS cannot    │
   │            do it          → usually short, sometimes empty │
   │  bucket 2  SaaS does it differently → our people work      │
   │            differently = CHANGE cost, not capability ◄─(3) │
   │  bucket 3  accumulated exceptions: the 2011 field, the     │
   │            report three people run, the discontinued       │
   │            product's workflow                        ◄─(4) │
   └───────────────────────────┬────────────────────────────────┘
                               ▼
        bucket 1 ~empty ──────────────▶ REPURCHASE
        bucket 2 large  ──────────────▶ REPURCHASE, but size it
                                        as a CHANGE PROGRAMME
        bucket 1 substantial and
        genuinely differentiating ────▶ REFACTOR in house; SaaS at
                                        most a component behind our
                                        own interface

  COST STRUCTURE AND WHO ABSORBS WHICH RISK             ◄─(5)
  ┌──────────────────────┬─────────────────────────────────────┐
  │ BUY                  │ BUILD                               │
  ├──────────────────────┼─────────────────────────────────────┤
  │ vendor absorbs: run  │ we absorb: everything               │
  │ risk, patching,      │                                     │
  │ availability,        │ we own: roadmap, data, and every    │
  │ capability roadmap   │ incident, dependency upgrade and    │
  │                      │ departure of the person who knew    │
  │ WE absorb:           │ the reconciliation logic            │
  │  integration risk    │                                     │
  │  data-portability    │ front-loaded cost, UNBOUNDED tail —  │
  │   risk               │ it doesn't finish, it enters        │
  │  roadmap risk        │ maintenance, which is how the NEXT  │
  │                      │ twenty-year-old system starts ◄─(6) │
  │ downside capped,     │ downside and upside both open       │
  │ upside capped ◄─(7)  │                                     │
  └──────────────────────┴─────────────────────────────────────┘
   For a non-differentiating capability, capping both is exactly
   right — there is no upside to capture.

  FOUR CONDITIONS ON THE BUY                              ◄─(8)
   a. data export DEMONSTRATED, not described — extract a real
      dataset and confirm we could operate from it
   b. integration built to OUR domain model behind an anti-
      corruption layer (D5-Q11), so their model doesn't propagate
   c. a named business owner runs process change, resourced as
      the LARGER half of the project
   d. bucket-1 inventory with an explicit decision each: adopted,
      dropped, or built alongside — decided now, not during UAT

  REFUSED: buy it and customise it heavily.               ◄─(9)
   Cost structure of buying, change cost of building, and an
   upgrade path that breaks every release.
```

**Every arrow explained:**

1. **Differentiation is the axis** — not features, not cost totals.
   For an internal system the honest answer is usually "no," which
   moves the burden of proof onto rebuild.
2. **Split the customisations with usage data** — opinions inflate the
   essential set dramatically. Asking who uses what, how often, is the
   cheapest and most decisive piece of analysis in this whole
   question.
3. **Bucket two is a change cost, not a capability gap** — "the SaaS
   does it differently" means our people work differently. That's real
   and it's usually much smaller than the rebuild it's used to
   justify.
4. **Bucket three is the accumulation** — twenty years of exceptions
   nobody has revisited. Counting these as requirements is how an
   organisation concludes no product on the market can meet its needs.
5. **Frame cost as structure and risk ownership** — total-cost
   comparisons at this stage are usually constructed to support a
   conclusion someone already reached. Who absorbs which risk is the
   part that's actually decidable.
6. **Build's tail is unbounded** — the system doesn't finish, it
   enters maintenance, and unattended internal maintenance is exactly
   how the current twenty-year-old system came to exist.
7. **Buy caps both downside and upside** — and for a capability with
   no upside to capture, capping both is the right trade. Naming the
   asymmetry is the decision content.
8. **Four conditions, all required** — demonstrated export, our domain
   model behind an anti-corruption layer, a named business owner for
   process change, and an explicit decision per bucket-one capability
   before user acceptance testing rather than during it.
9. **The refused middle path** — buying and heavily customising takes
   the worst properties of both: a vendor's cost structure, a
   rebuild's change cost, and an upgrade path that breaks on every
   release. Heavy customisation being necessary is evidence for
   rebuild, not a plan for buying.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| Deciding axis | Differentiation | Feature-by-feature comparison | A feature matrix always favours the incumbent, because it was built from the incumbent's behaviour | When there's a genuine regulatory capability at stake — then the specific capability is a gate, and a matrix of exactly those gates is the right instrument |
| Default for a non-differentiating system | Repurchase | Refactor in house | Buy caps a downside that has no matching upside to protect | When the capability is differentiating, or when the organisation has a standing product team and the system is central enough to deserve one |
| "We need our customisations" | Split by usage into three buckets | Accept the claim as stated | Most of the set is accumulated exception, and treating it as requirement kills every buy option | When the customisations encode a regulated process specific to our licence or jurisdiction — then they're constraints and the analysis just confirms it |
| Integration approach | Anti-corruption layer, our domain model | Integrate surrounding systems directly to the vendor's model | Keeps a future vendor change possible; otherwise their model is in forty places | When the SaaS is genuinely the system of record for that domain estate-wide and the vendor relationship is strategic and long-term — then a thinner layer is honest |
| Heavy customisation of the SaaS | Refused; treat it as evidence for rebuild | Buy and customise to match today's process | Takes buying's cost structure, building's change cost, and breaks on every upgrade | When the "customisation" is configuration the product explicitly supports and upgrade-tests — a real distinction worth confirming with the vendor's own release process |

**What a weak answer sounds like**

- "It depends on the total cost of ownership." — it doesn't, mostly,
  and at this stage both numbers are constructed. The decision is
  about differentiation and risk ownership, and a candidate who
  retreats to a cost model is avoiding the call.
- "Our processes are unique, so we'd have to build." — unique and
  differentiating are different words. Twenty years of accumulated
  exceptions feels unique from the inside and usually isn't.
- "We'd buy it and customise it to match what we do now." — the
  refused middle path. It's the most commonly chosen option and the
  one with the worst properties of both.
- "SaaS means we lose control." — control of what, and worth what?
  Some loss of control is exactly what's being purchased, and the
  useful version of this concern is the export test and the
  anti-corruption layer, not the sentiment.

**Common wrong turns**

- **Running a feature comparison first.** The matrix gets built from
  the incumbent's behaviour, so the incumbent always wins. Recover by
  doing the differentiation question and the usage analysis before
  anyone opens a spreadsheet.
- **Letting the people who own the current system define the
  requirements.** Their expertise is real and so is their stake.
  Recover by sourcing requirements from usage data and from the
  business process owner, with the incumbent team as reviewers rather
  than authors.
- **Treating this as a technology decision.** It's a change programme
  with a technology component. Recover by naming the business owner
  and resourcing the process work as the larger half.
- **Skipping the export test because the vendor says there's an API.**
  An API is not an operable dataset. Recover by extracting real data
  and confirming what you could do with it, before signing.

**Follow-up probes the interviewer asks next**

1. **"The SaaS vendor gets acquired in two years and the product is
   sunset. What did your design buy you?"** — the anti-corruption
   layer and the demonstrated export. That combination means the
   replacement is a project rather than a crisis, and the surrounding
   systems don't all change. It's the entire reason those two
   conditions are conditions rather than preferences.
2. **"Escalate this: what's the worst outcome of the buy
   decision?"** — the vendor becomes unremovable. Their data model is
   in every surrounding system, the export is technically available
   and operationally useless, and a price increase or a capability
   regression has no answer. That's not hypothetical — it's the
   default outcome if the two conditions above get traded away under
   schedule pressure, which is exactly when they will be.
3. **"The team that runs the current system is against this. How do
   you handle it?"** — take the technical objections seriously and
   separate them from the ones about their own future, which are
   legitimate and different. Then deal with the second set directly
   rather than pretending it's not in the room — that's `D5-Q14`, and
   handling it badly is how a repurchase acquires an internal
   opposition that outlasts the project.
4. **"Would you answer differently for a customer-facing system?"** —
   often yes, because the differentiation question has a different
   answer and the upside a rebuild protects is real. I'd still run the
   same three-bucket analysis, because customer-facing systems
   accumulate exceptions too.
5. **"How would you get comfortable with the vendor's availability?"**
   — their track record, their published commitments, and what our own
   dependency actually is — whether claims handling can continue
   degraded for a day. What I'd avoid is treating their stated
   availability figure as a substitute for knowing what we do when
   it's not met.
6. **"What if leadership has already decided to buy?"** — then I'd
   spend the influence on the four conditions rather than reopening
   the decision, because those determine whether the commitment is
   recoverable. That's the same posture as `D1-Q17` and for the same
   reason.

**Cross-references**

- `03-comparisons/04-migration-strategies.md` — the repurchase row and
  its change-management dimension; the organisational table there is
  the backbone of the process-change argument.
- `D1-Q17` for the build-versus-buy framing applied to a platform
  rather than an application; `D5-Q11` for the anti-corruption layer
  that condition (b) requires.
- `D5-Q14` for the team-side consequences; `D5-Q15` for how this gets
  funded when the business only pays for visible increments.

---

### D5-Q13 — "Wave four is at 40% of traffic on the new stack and error rates are climbing. Walk me through the next hour."

| | |
|---|---|
| **Band** | Staff+ |
| **Primary domain leaves** | 5.1, 6.2 |
| **Axis** | time |
| **Whiteboard time** | 30–40 min |
| **Reads well after** | `D5-Q04` |

**What the interviewer is actually testing**

Whether you know that the important work happened before the incident.
A candidate who starts debugging has failed the question; a candidate
who says "the rollback criteria were agreed before the ramp started
and the person on the call is executing, not deciding" has passed the
first half of it. The second half is the branch most people miss:
whether rolling back actually helps depends on whether the errors
follow the traffic.

**Clarifying questions to ask before drawing anything**

- **What exactly is climbing — error rate, latency, or a business
  metric?** A rising error rate with a flat business metric is a
  different situation from orders failing, and the urgency differs by
  an order of magnitude.
- **Is the error class new, or is it a pre-existing rate that's now
  visible?** Migrations routinely surface errors the legacy system was
  swallowing. Rolling back would hide it again, which is not the same
  as fixing it.
- **Do the errors track the traffic share?** If 40% of traffic is
  producing far more than 40% of the errors, it's the new stack. If
  errors are proportionally distributed, it's shared and rollback
  won't help.
- **Have any writes landed on the new path?** Determines whether
  rollback is a routing change or a data problem. This should already
  be known from the plan, not discovered now.
- **What were the pre-agreed abort thresholds?** If nobody can answer
  this in ten seconds, the real finding is that the wave started
  without them.

**Requirements — stated, and what you'd assume out loud**

| Requirement | Stated or assumed | If assumed, say this out loud | Why it drives the design |
|---|---|---|---|
| Abort thresholds agreed before the ramp | Stated by me | "If they weren't, that's the actual incident and I'd say so in the review" | Turns a judgement call under pressure into an execution step |
| Traffic split is configuration, not deployment | Assumed (from `D5-Q04`) | "Rolling back must be a variable change; if it needs a deploy, we're minutes not seconds from safe" | Determines how fast step one can happen |
| The old stack is still warm | Assumed | "It stays funded through the soak — that's the price of the rollback" | A rollback into cold capacity isn't a rollback |
| Schema changes were expand-then-contract | Assumed | "Nothing in this wave made a change the old code can't read" | Keeps the rollback path valid |
| Writes are reconcilable | Assumed | "Any write that landed on the new path has an idempotency key and a reconciliation source" | Decides whether rollback is clean or leaves residue |

**The answer, out loud**

The first thing I'd say is that by the time this is happening, the
decision has already been made. The abort thresholds were written down
before the ramp started, the rollback was rehearsed, and the person on
the call is executing a procedure rather than exercising judgement
under pressure. If that's not true, then the real finding isn't the
error rate — it's that we started a ramp without the conditions for
stopping it, and I'd want that in the review regardless of how this
hour ends.

Given that, here's the hour.

Minute zero: freeze the ramp. Not roll back — freeze. Stopping the
increase is free, instant and reversible, and it buys the time to make
the actual decision without the situation getting worse while we
think. Rolling back immediately is the instinct and it's slightly
wrong, because it destroys the evidence and often the ability to
reproduce.

Minute two: classify the signal. Is this a new error class, or an
existing one that the new stack is surfacing and the legacy system was
swallowing? That happens more than people expect — the legacy system
returns a success for something it silently dropped, and the new one
correctly reports failure. If that's what this is, rolling back hides
a real problem and I'd want to say that explicitly rather than quietly
reverting.

Minute five, and this is the branch that matters: do the errors follow
the traffic? If the new stack has 40% of traffic and is producing the
overwhelming majority of errors, it's the new stack and rollback will
help. If errors are roughly proportional across both paths, the cause
is shared — the database, the network, a downstream dependency, a
change that shipped this morning — and rolling back will do nothing
except remove our ability to test the new path. I've seen teams roll
back, see no improvement, and conclude the rollback failed, when in
fact the rollback worked perfectly and was irrelevant. This branch is
the difference between a competent hour and a wasted one.

Minute ten, assuming it's the new stack: roll back to the last
known-good percentage, not to zero. If 10% was healthy for two days,
go to 10%. Going to zero is the reflex and it discards the one thing
that lets us reproduce the problem — some real traffic on the new
path — and it makes the resumption decision harder because we'll have
no recent evidence. If the error is severe enough that no customer
should touch the new stack, then zero, and that's a judgement the
pre-agreed thresholds should cover.

Minute fifteen: the data question. Any writes that landed on the new
path during the window need to be accounted for. If the wave followed
`D5-Q04`, write authority moved per entity and reverse replication was
armed, so the legacy store is current and rollback is clean. If writes
ramped as a percentage — which shouldn't have happened — then this is
a reconciliation exercise and it's the part of the hour that actually
takes time.

Minute twenty onward: hold, and communicate. State what we know, what
we don't, what the current traffic split is and when we'll next
update. The temptation is to keep debugging quietly until there's an
answer; the cost of that is that everyone else starts investigating
independently.

And then the part that isn't in the hour: the wave doesn't resume
until two things are true. The specific failure is understood — not
"it seems stable now" — and the rollback we just performed is
reviewed for whether it worked as designed. A rollback that
technically succeeded but took twenty minutes because someone had to
edit a configuration by hand is a finding, and it's the most valuable
thing this incident produces.

I'd also name what makes all of this possible, because it's the
architectural content and not the incident management. Traffic control
is configuration, not deployment. Schema changes are expand-then-
contract, so the old code can always read what the new code wrote. The
old stack stays warm and funded through the soak. Writes are
idempotent and there's a reconciliation source. Those four properties
are decided weeks earlier, and an organisation that has them gets a
calm hour, while one that doesn't gets an outage.

**Architecture**

```
  THE NEXT HOUR — a procedure, not a judgement call
  ────────────────────────────────────────────────
  PRECONDITION: abort thresholds were written BEFORE the ramp.
  If nobody can state them in ten seconds, THAT is the incident. ◄─(1)

  min 0   ┌──────────────────────────────────────────────────┐
          │ FREEZE THE RAMP — do not roll back yet     ◄─(2) │
          │ free, instant, reversible; buys thinking time     │
          │ without the situation worsening                   │
          └────────────────────┬─────────────────────────────┘
                               ▼
  min 2   ┌──────────────────────────────────────────────────┐
          │ CLASSIFY: new error class, or a PRE-EXISTING rate │
          │ the legacy system was swallowing?           ◄─(3) │
          │ if pre-existing → rollback HIDES a real problem.  │
          │ Say so out loud rather than quietly reverting.    │
          └────────────────────┬─────────────────────────────┘
                               ▼
  min 5   ┌──────────────────────────────────────────────────┐
          │ THE BRANCH — do the errors FOLLOW the traffic?    │
          │                                             ◄─(4) │
          │  40% of traffic, most of the errors                │
          │        └──▶ it IS the new stack. Rollback helps.  │
          │                                                   │
          │  errors roughly PROPORTIONAL across both paths     │
          │        └──▶ shared cause: database, network, a    │
          │             downstream dependency, this morning's │
          │             deploy. ROLLBACK WILL NOT HELP. ◄─(5) │
          │             (Teams roll back, see no change, and  │
          │              conclude the rollback failed. It     │
          │              worked. It was irrelevant.)          │
          └────────────────────┬─────────────────────────────┘
                    new stack  ▼
  min 10  ┌──────────────────────────────────────────────────┐
          │ ROLL BACK TO LAST KNOWN-GOOD PERCENTAGE, NOT ZERO │
          │ 10% healthy for two days → go to 10%.       ◄─(6) │
          │ Zero destroys reproducibility and makes the       │
          │ resume decision evidence-free. Zero only if the   │
          │ pre-agreed threshold says no customer may touch   │
          │ the new path.                                     │
          └────────────────────┬─────────────────────────────┘
                               ▼
  min 15  ┌──────────────────────────────────────────────────┐
          │ THE DATA QUESTION — did writes land on the new    │
          │ path? Per D5-Q04, authority moved per entity and  │
          │ reverse replication was armed → rollback is clean.│
          │ If writes ramped as a PERCENTAGE (they shouldn't  │
          │ have), this is reconciliation and it is the part  │
          │ of the hour that actually takes time.       ◄─(7) │
          └────────────────────┬─────────────────────────────┘
                               ▼
  min 20+ HOLD AND COMMUNICATE — what we know, what we don't,
          current split, next update time. Silent debugging  ◄─(8)
          makes everyone else start investigating in parallel.

  NOT IN THE HOUR: the wave does not resume until (a) the specific
  failure is understood — not "it seems stable now" — and (b) the
  rollback itself is reviewed. A rollback that worked but took
  twenty minutes of hand-editing is the most valuable finding here.

  WHAT MADE THE CALM HOUR POSSIBLE — decided weeks earlier: ◄─(9)
   traffic control is CONFIG not deployment; schema changes are
   expand-then-contract; the old stack is WARM and funded; writes
   are idempotent with a reconciliation source.
```

**Every arrow explained:**

1. **The thresholds are the precondition** — they convert an hour of
   judgement under pressure into an hour of execution. Their absence
   is a more serious finding than whatever the error rate turns out to
   be.
2. **Freeze before rolling back** — stopping the increase is free and
   instant; rolling back immediately destroys evidence and often
   reproducibility. The instinct is to revert, and it's slightly
   wrong.
3. **Distinguish new errors from newly-visible ones** — legacy systems
   swallow failures. Rolling back to hide a real problem is a decision
   someone should make knowingly, not by default.
4. **The proportionality branch** — whether errors follow the traffic
   share decides whether rollback is the right tool at all. This is
   the single highest-value step in the hour.
5. **A shared cause means rollback is irrelevant, not failed** — teams
   roll back, see no improvement, and misdiagnose their own remedy.
   Knowing this branch exists prevents twenty wasted minutes and a
   wrong conclusion.
6. **Roll back to last known-good, not to zero** — preserves the
   ability to reproduce and to make an evidence-based resumption
   decision. Zero is correct only when the pre-agreed threshold says
   no customer may touch the new path.
7. **The data question decides whether rollback is clean** — per-entity
   write authority with reverse replication makes it a routing change.
   Percentage-ramped writes make it a reconciliation exercise, which
   is why `D5-Q04` forbids them.
8. **Communicate on a cadence** — silent debugging causes parallel
   uncoordinated investigation, which is its own incident.
9. **Four properties decided weeks earlier** — configuration-based
   traffic control, expand-then-contract schema changes, a warm
   funded old stack, idempotent writes with a reconciliation source.
   These are the architecture; the hour is just what they enable.

**Tradeoff table**

| Decision point | What I chose | Alternative | Why it wins here | When the alternative wins instead |
|---|---|---|---|---|
| First action | Freeze the ramp | Roll back immediately | Freezing is free and reversible and preserves evidence; rolling back is neither | When the errors are customer-visible and severe — data corruption, failed payments — then immediate rollback and evidence comes second |
| Rollback target | Last known-good percentage | Zero | Keeps reproducibility and makes the resume decision evidence-based | When the failure class means no customer should touch the new path at all, which the pre-agreed thresholds should already specify |
| Diagnosis order | Proportionality branch before debugging | Debug the errors first | If the cause is shared, rolling back is irrelevant and debugging the new stack is wasted effort | When there's only one path carrying traffic (a completed cutover) — then proportionality tells you nothing and debugging is the only move |
| Decision authority | Pre-agreed thresholds, executed by whoever is on call | The architect decides live | Removes judgement under fatigue and makes the outcome independent of who happens to be awake | When the situation is genuinely outside anything anticipated — then escalate to a named decision-maker rather than improvising against the thresholds |
| Resumption | Only after the failure is understood and the rollback is reviewed | Resume when metrics look normal | "It seems stable now" is how the same failure recurs at a higher percentage | When the cause was external and independently confirmed resolved — a dependency's own incident, closed with their post-incident report |

**Making it concrete**

```bash
# Step one is a config change, not a deploy. If this needs a build,
# the wave was never safe to start.
gcloud compute backend-services update bes-orders-read \
  --global \
  --custom-request-header="X-Wave-Split: LAST_KNOWN_GOOD_PCT"

# The branch that decides whether any of this helps: are errors
# proportional to the traffic share, or concentrated on one path?
# This query is written and rehearsed BEFORE the ramp, not now.
```

The comment on the second block is the whole point of the snippet. A
query somebody writes during the incident is a query nobody trusts at
minute five, which is exactly when the decision has to be made.

**What a weak answer sounds like**

- "I'd roll back immediately and investigate afterwards." — often
  right and stated as a reflex. It loses the evidence, and it skips
  the branch where rolling back changes nothing.
- "I'd look at the logs and find the root cause." — that's an hour of
  debugging while customers are affected. The first hour is about
  traffic control; root cause comes after the bleeding stops.
- "We'd go to 0% and try again next week." — throws away the ability
  to reproduce, and "try again next week" without understanding the
  failure means repeating it at a higher percentage.
- "I'd get the team on a call and decide what to do." — if the
  decision is being made now, the ramp shouldn't have started. The
  thresholds exist so the call is about execution, not about what the
  acceptable error rate is.

**Common wrong turns**

- **Debugging before controlling traffic.** Comfortable and
  expensive. Recover by freezing first and holding the debugging for
  after the split is at a known-good value.
- **Assuming the new stack is guilty.** It usually is, and "usually"
  is what makes the proportionality check worth five minutes.
  Recover by running the check before acting on the assumption.
- **Rolling back the data along with the traffic.** If write authority
  moved cleanly, the rollback is a routing change; reverting data as
  well can create the divergence that didn't exist. Recover by
  separating the traffic decision from the data decision explicitly.
- **Resuming on the same day because the metrics recovered.** The
  metrics recovered because traffic moved, which proves nothing about
  the cause. Recover by making resumption conditional on
  understanding, with a named person who says yes.

**Follow-up probes the interviewer asks next**

1. **"The rollback itself fails — the old stack has been scaled down
   and can't take the traffic. What now?"** — then we're in an
   incident rather than a migration event, and the immediate move is
   load shedding and scaling the old stack while holding the new one
   at whatever share it can serve correctly. The real answer is that
   this scenario is created weeks earlier by scaling the legacy stack
   down to save money during the soak, which is exactly the cost that
   buys the rollback. I'd rather pay it.
2. **"Escalate this: the same wave fails twice. What changes?"** — it
   stops being a wave problem and becomes a factory problem. I'd pull
   that application out of the queue entirely, re-triage it
   (`03-comparisons/04-migration-strategies.md`), and look at whether
   the rehearsal environment is representative — two failures usually
   means the rehearsal is testing something different from production,
   which affects every remaining wave, not just this one.
3. **"Who has the authority to stop a ramp?"** — anyone on the call,
   without asking. Making a freeze require approval means it happens
   ten minutes late every time. Resuming, by contrast, needs a named
   approver. That asymmetry is deliberate and it's an organisational
   design decision as much as a technical one.
4. **"The business owner wants to push through because the deadline is
   tight. How do you respond?"** — by pointing at the threshold they
   agreed to, which is the entire reason it was agreed in advance and
   in writing. If they want to change it, that's a decision they can
   make explicitly, with the risk stated — what I won't do is let the
   threshold erode implicitly under schedule pressure.
5. **"What do you publish afterwards, and to whom?"** — the timeline,
   the cause, whether the rollback performed as designed, and what
   changes in the runbook. Distributed to every team with a wave
   ahead of them, because the finding is almost always general rather
   than specific to this application.
6. **"How would this hour look different at 90% instead of 40%?"** —
   materially worse, because the legacy stack is likelier to be cold
   and the reverse replication may have been turned off. Which is why
   the last percentage points of a ramp deserve the same rigour as
   the first, and why the decommission decision in `D5-Q04` step 7 is
   dated and signed rather than drifted into.

**Cross-references**

- `D5-Q04` for the cutover design that makes this hour survivable —
  particularly the write-authority and reverse-replication steps.
- `D5-Q01` for the wave factory this is one iteration of; `D5-Q02` for
  why a clean rollback in an early wave is a success.
- `03-comparisons/05-ha-dr-strategies.md` for the tier vocabulary
  behind "the old stack stays warm."

---
