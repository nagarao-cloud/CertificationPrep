# Senior / Staff-Level Interview Questions — Data Engineering

> **This is job-interview prep, not exam prep** (same disclaimer as
> `Interview-Questions.md`). The bar at senior/staff level is different
> again: nobody is testing whether you know what Kinesis is. They're
> testing whether they can hand you an ambiguous, political, or
> half-specified problem and trust your judgment on it. Every answer
> below optimizes for showing **reasoning under trade-offs**, not for
> naming the "correct" service — most of these questions don't have one.
>
> 20 questions across four sections: **Trade-off Judgment**,
> **Leadership & Mentorship**, **Cost Ownership**, and **Migration &
> Legacy Judgment**. Model answers are longer than the mid-level file's
> — at this level, interviewers expect you to show your work, name the
> alternative you rejected, and say why.

---

## Section 1 — Trade-off Judgment

### Q1. A team wants to add Apache Kafka (self-managed on EC2) instead of using Amazon MSK because "we know Kafka better than AWS does." How do you respond?

I'd separate the technical claim from the organizational one. The
technical claim — "we can run Kafka better than MSK" — is sometimes
true for teams with deep, current Kafka operational experience, but
it's rarely true for the *marginal cost* of that expertise once you
count broker patching, ZooKeeper/KRaft migration, rebalancing after a
broker failure, TLS cert rotation, and disaster recovery testing, all
of which MSK either automates or absorbs into AWS's operational
surface. I'd ask the team to quantify the actual gap: what specific
MSK limitation (custom broker configs, specific Kafka version, a
plugin MSK Connect doesn't support) is driving the "self-managed"
preference, versus is this really "we're comfortable with the old way
and don't want to learn a managed control plane." If there's a real
technical gap, self-managed on EC2 (or a case for a different tool
entirely) is defensible — I'd want it written down as an ADR
(architecture decision record) with the specific limitation named. If
it's comfort, I'd push back, because the hidden cost isn't today's
sprint, it's the on-call rotation eighteen months from now when the
person who set it up has moved teams and nobody else knows how to
recover a corrupted ZooKeeper ensemble at 2 a.m. Build-vs-buy at senior
level is really "who owns the 2 a.m. page," and that question usually
answers itself once you ask it out loud.

### Q2. When do you introduce a new AWS service into an already-complex stack versus extending what's already there?

My default bias is *extend first, introduce second* — every new
service is a new thing someone has to learn, monitor, patch their
mental model for, and reason about during an incident, and that cost
is paid by the whole team indefinitely, not just by the person who
picked it. So the bar for a new service is: can the existing stack do
this at all (even suboptimally), and if yes, is the suboptimality
actually costing us something measurable — money, latency, developer
time — or is it just aesthetically unsatisfying? I only cross that bar
when the new service removes an entire class of operational problem
rather than just doing the same job slightly better. A concrete
example: if a team is running Glue jobs on a cron-like schedule with
ad-hoc retry logic hand-coded in Python, and reliability incidents keep
tracing back to that hand-rolled retry logic, introducing Step
Functions isn't "one more service," it's *removing* a maintenance
burden (the custom retry code) and replacing it with a managed
primitive. Compare that to "let's add MSK because Kinesis works fine
but Kafka is more standard" — that's introducing complexity to solve a
preference, not a problem, and I'd say no.

### Q3. How do you prioritize technical debt against feature work when the business keeps asking "why aren't we shipping faster"?

I stop treating "tech debt" as a separate backlog category competing
for priority against features, because that framing always loses — debt
is invisible until it isn't, and features are visible every sprint. Instead I
attach debt items to the feature or incident that makes their cost
undeniable: "the reason the last three feature requests each took two
weeks longer than estimated is the DynamoDB table has no GSI for the
query pattern we keep needing, and every new feature pays that tax
again." Framed that way, paying down the debt *is* a velocity
investment, not a competing priority, and it's a much easier
conversation with a business stakeholder who cares about throughput,
not code quality in the abstract. For debt that doesn't have an
attached feature yet, I keep a short, ruthlessly curated list — not
everything that annoys an engineer belongs on it — and I bring one item
per planning cycle with a concrete cost estimate ("this Glue job's
manual bookmark reset costs us roughly 3 hours of on-call time a
month"). If leadership still says no after seeing the number, that's a
legitimate business call and I don't relitigate it every sprint — I
just make sure the cost is visible again the next time it bites us.

### Q4. A data scientist wants a dedicated Redshift cluster for their team "so we don't get blocked by other teams' queries." What's your actual response?

The instinct behind the request is right — noisy-neighbor query
contention is a real problem — but a dedicated cluster is the most
expensive way to solve it and creates a second problem (data
duplication, sync lag, doubled operational surface) to fix the first.
I'd walk through the options in order of operational cost before
agreeing to a new cluster: first, WLM query queues or Redshift
Serverless's automatic workload isolation, which solve "my heavy query
blocks your dashboard" without provisioning anything new; second,
**concurrency scaling**, which adds transient capacity automatically
during bursts and removes itself when the burst ends; third, if the
data scientist's workload is genuinely a different *shape* (ad-hoc,
bursty, exploratory) rather than just competing for the same resource,
Redshift Serverless or even Athena against the same S3/Iceberg data
might be the right tool entirely, sidestepping cluster contention by
not sharing a cluster at all. A dedicated provisioned cluster is the
answer only after those are ruled out — and even then, I'd push for
data sharing (zero-copy, one source of truth) over a second COPY
pipeline into a second cluster, because a second copy of the data
immediately creates a "which one is right" problem six months from
now.

### Q5. Your team has both Glue and EMR in production, doing conceptually similar transformation jobs. Do you standardize on one? How do you decide?

I wouldn't standardize just for the sake of having one tool — that's
optimizing for a tidy architecture diagram, not for outcomes. I'd look
at what's actually driving the split: if it's genuinely workload shape
(Glue for catalog-native, bookmark-driven incremental jobs; EMR for
existing Spark code, custom cluster tuning, or workloads at a scale
where Glue's DPU model gets expensive relative to Spot-heavy EMR), the
split is a feature, not debt, and I'd document *why* each exists so a
new hire doesn't "fix" it by accident. If the split is historical —
team A used Glue because that's what they knew, team B used EMR
because that's what they knew, and the workloads are actually
interchangeable — that's real debt, because you're paying for two
operational models (two monitoring setups, two sets of runbooks, two
skill sets to maintain) for no architectural reason. In that case I'd
migrate the smaller footprint onto the pattern that's cheaper to run
*and* has fewer distinct skills required, document the migration as a
project with its own budget rather than "squeeze it in," and set a
policy for future jobs so the split doesn't silently regrow.

---

## Section 2 — Leadership & Mentorship

### Q6. You're reviewing a junior engineer's Glue job. It works, passes tests, but reads the entire table on every run instead of using bookmarks or partition pruning. How do you handle the code review?

I don't lead with the fix — I lead with a question, because the goal
of the review is that they understand *why* this matters next time,
not that this one PR gets patched. Something like: "walk me through
what happens to the runtime and cost of this job in six months when
the table is 50x bigger — does anything here change?" That usually
gets them to the answer themselves, which sticks far better than me
stating it. If they don't get there, I'll explain concretely: a full
table scan on every run means cost and runtime both grow linearly with
total data volume forever, while a bookmark-driven or partition-pruned
job's cost grows with *new* data only — and I'd point at the specific
line where the fix goes (job bookmarks enabled, or a `pushdown_predicate`
on the partition column) rather than leaving it as vague advice. I'd
also make clear this isn't a blocker on shipping if there's time
pressure and the table is currently small — but I'd file a
follow-up ticket with the growth threshold at which it *will* become a
problem, so it doesn't silently become an incident instead of a code
review comment. The distinction I care about in my own reviews:
correcting the code is a five-minute task; building the engineer's
instinct for "what does this cost at 50x scale" is the actual job.

### Q7. A junior engineer pushes back on your feedback, arguing their approach is "simpler." How do you handle disagreement without just pulling rank?

First, I take the claim seriously rather than defending my suggestion
by default — junior engineers are sometimes right, and "simpler" is a
real design value I'd rather reinforce than punish. I'd ask them to
walk me through simpler *for whom, and over what time horizon* —
simpler to write today can be more complex to operate in six months
(a hand-rolled retry loop is simpler to write than adopting Step
Functions, but it's more complex for the next person who has to debug
why a job silently stopped retrying after an edge case the loop didn't
handle). If after that conversation their approach genuinely is
simpler along the dimension that matters for this specific piece of
work, I say so explicitly and we ship theirs — reinforcing that
pushback is welcome, not just tolerated, is worth more long-term than
being right on one PR. If I still think my approach is right after
hearing their reasoning, I explain the specific operational failure
mode I'm worried about, concretely, not abstractly ("here's the exact
incident I watched this pattern cause at my last job"), and if we
still disagree after that, I'll make the call as the senior person
because someone has to, but I say so plainly rather than pretending
it's still open — pretending to be persuaded when you're not is worse
for trust than an honest "I hear you, I'm still going to ask for the
other approach here, and here's why."

### Q8. A product manager asks for a real-time streaming pipeline "just to be safe" when the actual requirement is a report that refreshes once a day. How do you push back on a poorly-specified requirement?

I don't push back by saying no — I push back by asking what decision
the "real-time" requirement is meant to enable, because "just to be
safe" is almost always a proxy for an unstated concern, and the
concern is usually solvable more cheaply once it's explicit. Common
answers: "I'm worried the batch job will be late and the report will
be stale when leadership looks at it Monday morning" (solved by a
reliable, monitored nightly batch job with an SLA and an alert, not by
streaming), or "I think we'll eventually need real-time and don't want
to redo the work" (a real concern, but "eventually" and "now" have very
different cost profiles, and building for hypothetical future scale
before it exists is exactly the kind of unrequested complexity that
becomes tech debt). I'd lay out the cost difference concretely — a
nightly Glue job is simpler to build, cheaper to run, and easier to
debug than a Kinesis-plus-Flink pipeline with checkpointing and 24/7
on-call exposure — and let the PM make an informed trade-off instead of
a reflexive one. If, after that conversation, there's a real business
reason for real-time (a concrete decision that has to be made same-day,
not next-day), I'll build it — the point isn't to always say no to
streaming, it's to make sure the requirement reflects an actual need
rather than a vague anxiety, because I'm the one who inherits the
operational cost of guessing wrong.

### Q9. How do you mentor an engineer who is technically strong but keeps over-engineering solutions — solving for scale or flexibility the team doesn't need yet?

I try to give them a concrete, falsifiable question to ask themselves
before reaching for the general solution: "what specific, named future
requirement does this flexibility serve, and who told you it's coming
in the next two quarters?" If the answer is "I imagine we might need
X," that's a signal to build the narrow thing now and leave a clean
seam to extend later, rather than the general thing today. I'll pair
that with a concrete story rather than abstract advice — pointing to a
past over-engineered piece of infrastructure (mine or someone else's)
that ended up wrong in a way that would've been cheap to fix if we'd
built the narrow version, but was expensive to unwind because the
generalized version had accumulated dependents by the time the real
requirement showed up and turned out to be different from what was
guessed. I also make a point of praising the *instinct* even while
redirecting the *output* — the ability to see the general shape of a
problem is genuinely valuable, especially at review/architecture time —
I just want it applied as a design sketch on a whiteboard, not as
production code for a requirement that doesn't exist yet. Over time
the goal is for them to internalize "cheapest reversible decision now,
not the most future-proof one," which is a judgment call, not a rule,
so it takes repeated concrete examples rather than one conversation.

### Q10. You inherit a team whose previous lead built everything as one-off scripts with no shared conventions. Morale is low and every new engineer takes months to ramp. What do you actually do in the first 90 days?

I'd resist the urge to do a big-bang rewrite — that's the classic
new-lead mistake, and it burns trust with a team that's already tired,
while producing months of no visible feature output that erodes
confidence from above too. Instead: first 2–3 weeks, I listen and map —
what exists, what's actually load-bearing versus what could be deleted
outright, and where the team's *own* pain is loudest, because their
list and my list from a fresh read of the code are rarely identical and
theirs is the one that rebuilds trust fastest if I act on it. Then I'd
pick one visible, contained win — often a shared IaC template (CDK or
CloudFormation) for the most-repeated pattern in the codebase, or a
runbook for the incident that pages people most often — and ship it
with the team, not for them, so the convention has buy-in rather than
being imposed. From there, conventions get documented as they're
established, not written up front as a big style guide nobody reads —
a style guide with zero examples of real code following it doesn't
change behavior. Ramp time for new engineers is a good trailing metric
to watch — if it's not improving within two or three quarters, the
conventions aren't actually taking, and it's worth an honest look at
whether the *team*, not just the codebase, needs more structural
change.

---

## Section 3 — Cost Ownership

### Q11. Your team's AWS bill has grown 40% quarter over quarter, but nobody feels individually responsible for it. How do you fix that?

Diffuse ownership is the root cause more often than any single wasteful
resource, so the fix is structural before it's technical. I'd start by
making cost *visible and attributable* — tags on every resource by team
and workload (enforced via SCP or Config rule, not a wiki page nobody
follows), and a weekly or monthly report broken down by team rather
than one aggregate number nobody can act on, because "the AWS bill grew
40%" is nobody's problem but "your team's Redshift cluster grew 40%"
is somebody's problem. Then I'd tie cost to a decision each team
already makes routinely — code review, sprint planning — the same way
correctness or test coverage is tied in, rather than treating it as a
separate quarterly cost-cutting fire drill that burns out and reverts
by the next quarter. A concrete mechanism that works well: put the
Cost Explorer view (or a Lambda-generated summary) in the same
dashboard or channel the team already checks for on-call and CI status,
so cost is part of the ambient signal, not a special report someone has
to go looking for. Finally, I'd pick one or two teachable examples —
"here's the exact query pattern that was scanning the whole table on
Athena and cost $400 last week for what should've cost $8 with
partition pruning" — because a concrete story that names a real dollar
figure changes behavior far faster than a policy document.

### Q12. You find a workload that's technically correct but wildly over-provisioned — say, an EMR cluster running 24/7 at 15% utilization for a job that runs for two hours a day. How do you approach the fix, and the conversation with the team that owns it?

Technically the fix is straightforward — EMR Serverless, or a
transient cluster that spins up for the job and terminates after, or
at minimum a scheduled scale-down — but I treat the conversation as
more important than the fix, because the team that built this didn't
do it maliciously; they optimized for "never wait for cluster
provisioning again" without anyone putting a dollar figure next to that
convenience. I'd bring the actual number first, not the fix — "this
cluster running idle 22 hours a day costs approximately $X/month; the
same two hours of work on EMR Serverless or a transient cluster would
cost approximately $Y" — and let the gap make the case, because
engineers respond to concrete numbers far better than to being told
their setup is "inefficient." I'd also ask why the persistent cluster
was chosen in the first place before assuming it's pure oversight —
sometimes there's a real reason (warm JVMs avoiding a cold-start
penalty that matters for a downstream SLA) and the fix needs to
preserve that property, which is exactly why I ask instead of just
filing a ticket to change it. Once we agree on the fix, I'd make sure
it ships with a monitoring check (a CloudWatch alarm on utilization, or
a cost anomaly alert) so the next over-provisioned resource gets caught
by a system, not by someone stumbling on the bill months later.

### Q13. Leadership wants a "20% AWS cost reduction" target. How do you make sure that target doesn't get hit by degrading reliability or by quietly deferring necessary work?

I'd push to define the target as cost *per unit of value* — cost per
pipeline run, cost per GB processed, cost per active user — rather than
a flat dollar target, because a flat target is trivially satisfiable by
just doing less work, which looks like success on a spreadsheet and is
actually a regression. I'd also insist any cost-cutting change go
through the same review bar as any other production change — no
"just turn off the DR replica to hit the number by end of quarter" —
because cost cuts made under time pressure are exactly the ones that
show up as an incident two months later when nobody remembers the
corner was cut. Concretely, I'd inventory cost reductions into two
buckets before committing to a number: waste elimination (idle
resources, missing partitioning, S3 storage class mismatches,
un-tuned Redshift WLM causing concurrency-scaling overage) which is
free money with no trade-off, and capability trade-offs (dropping a
replica, reducing retention, moving off Reserved Instances) which
genuinely trade something for the savings and need an explicit
sign-off from whoever owns that risk, not an engineer quietly deciding
it on their own. I'd commit to a number only after that inventory,
because committing to 20% before knowing how much is actually free
money versus how much requires a real trade-off is how teams end up
cutting monitoring or DR to hit an arbitrary target.

### Q14. How do you decide when Reserved Instances / Savings Plans are worth the commitment versus staying On-Demand or moving to serverless?

I look at the shape of the workload's utilization over a realistic
history window, not a guess — if a Redshift cluster or EMR fleet has
run at consistently high, predictable utilization for the last 3–6
months with no planned architectural change, a 1-year (rarely 3-year,
given how fast this stack evolves) Savings Plan is close to free money,
because you're committing to spend you were already going to spend
anyway, just at a discount. Where I get cautious is on workloads that
are *currently* steady but where I know a re-architecture is already
planned or plausible — committing to a Reserved Instance right before
migrating that workload to Serverless locks in savings on a resource
you're about to stop using, which is a worse outcome than staying
On-Demand a little longer and moving straight to Serverless. For
genuinely spiky or unpredictable workloads, I don't fight the
variability with a commitment at all — that's exactly the case
Serverless options (Redshift Serverless, EMR Serverless, Aurora
Serverless) exist for, since paying a premium per unit but only for
units you actually use beats a large fixed commitment against unknown
future load. The overall heuristic I give teams: commit money to
patterns you're confident will still be true in a year; use
serverless or on-demand for patterns you're not confident about yet,
and revisit the split quarterly rather than setting it once and
forgetting it.

### Q15. A team wants to keep a Redshift cluster running at a larger node count than needed "in case a big query comes in," rather than using concurrency scaling or Serverless. How do you evaluate that instinct?

I take the underlying fear seriously — a query timing out or queuing
during a leadership demo is a real, memorable pain that drives this
kind of over-provisioning — but the fix they've picked (permanently
larger fixed capacity) pays for worst-case headroom every hour of every
day instead of only when the worst case actually happens, and
Redshift's own concurrency scaling and Serverless RPU auto-scaling
exist specifically to solve this without the standing cost. I'd ask
them to pull the actual query history — how often does a query
genuinely need more capacity than the smaller cluster provides, and for
how long — because in most cases the answer is "rarely, and briefly,"
which is precisely the profile concurrency scaling is priced for
(free burst credits accrue hourly, and you only pay per-second beyond
that during actual bursts). If the answer instead is "constantly," that's
not a headroom problem, it's a genuine capacity problem, and the fixed
larger cluster (or Serverless at a higher base RPU) is the honest
answer — but I want that distinction made from data, not from the
memory of one bad demo. Either way, I'd frame it back to them as "we
can get the same protection against a bad demo for a fraction of the
cost, with actual usage data to prove it's still there when needed" —
that reframing usually lands better than "you're overpaying," because
it addresses the fear directly instead of just the symptom.

---

## Section 4 — Migration & Legacy Judgment

### Q16. You're asked to lead the migration of a 10-year-old on-prem Hadoop cluster to AWS. Where do you actually start?

Not with the technology — with an honest inventory of what's actually
running on that cluster and *why*, because a decade-old Hadoop
environment reliably has jobs nobody fully understands anymore,
undocumented downstream consumers, and at least one "temporary" fix
from years ago that quietly became load-bearing. I'd start by pulling
job logs and access patterns over a real window (ideally 90 days) to
build a factual map of what runs, how often, how much data it touches,
and who consumes the output, rather than trusting the wiki or asking
people from memory — memory is wrong about legacy systems more often
than people expect. From that inventory I'd bucket jobs into three
groups: straightforward lift (a well-understood Spark job that maps
cleanly onto EMR or Glue with minimal change), needs redesign (jobs
built around HDFS-specific assumptions, or MapReduce patterns that are
genuinely obsolete and should become Glue/Spark-native rather than
ported as-is), and archaeology required (jobs nobody currently on the
team can explain, which need a human conversation with whoever
originally built them, or with the business owner of the output,
before anyone touches the code). Only after that mapping would I
propose a migration sequence — and I'd sequence by *risk and
reversibility*, not by technical ease: start with a job that's low-risk
if something goes briefly wrong and has a clear way to verify parity
against the old output, to build organizational confidence and a
working migration pattern before touching anything business-critical.

### Q17. Midway through that Hadoop migration, you discover a critical nightly job that half the finance org depends on, and it's the "archaeology required" bucket — nobody can fully explain what it does. How do you proceed?

I don't migrate it blind, and I don't let "we're on a timeline" push me
into guessing at business logic that finance depends on — a wrong
number in a finance report is a much worse outcome than a slipped
migration date. First step is finding the actual humans who consume the
output and asking what they check it against — often finance has an
independent number (a general ledger total, a reconciliation report)
they already use to sanity-check this job's output, which becomes my
parity test even if I can't fully read the code. I'd run the legacy job
and a reimplemented version in parallel — legacy stays the source of
truth, new version runs alongside and its output gets diffed against
the old one and against finance's independent check, for at least one
full close cycle, ideally more given how much finance logic is
period-dependent (quarter-end, year-end edge cases that a 30-day window
won't surface). I would explicitly flag the risk and the extended
timeline to my manager and to finance stakeholders rather than quietly
absorbing the schedule pressure — "this specific job needs more
validation time because nobody can currently explain its full logic, and
getting it wrong costs more than the extra two weeks" is exactly the
kind of judgment call a senior engineer is expected to surface, not
solve alone under pressure. Only after a clean parallel-run period would
I cut over, and I'd keep the legacy path runnable for at least one
more cycle as a rollback option, because "it looked right for a month" is
not the same guarantee as "it's been right through every edge case this
system encounters."

### Q18. The Hadoop-to-AWS migration project stalls because stakeholders can't agree whether to lift-and-shift onto EMR or rebuild natively on Glue + S3 + Iceberg. How do you break the deadlock?

I'd reframe the argument away from "which is architecturally better in
the abstract" — that debate can run forever because both are legitimate
in different conditions — toward "what does this specific migration's
constraints actually require." Lift-and-shift onto EMR wins when
there's a hard deadline (an on-prem data center lease expiring, a
hardware refresh nobody wants to fund again) and a large body of
working Spark code that's expensive to rewrite correctly under time
pressure — the goal there is "off of on-prem, safely, on schedule,"
with modernization as a deliberate phase two, not blocked on phase one.
Rebuilding natively on Glue/S3/Iceberg wins when the existing code is
already known to be a mess nobody wants to carry forward, when
there's no hard deadline forcing speed over quality, or when the
business case for the migration *is* the modernization (cost, Iceberg's
ACID/time-travel capabilities, moving off self-managed cluster
operations entirely). I'd get the room to agree on which of those two
situations we're actually in — usually that's a factual question with a
real answer, not an opinion — and let that decide the approach, rather
than let the debate be a proxy for team politics (EMR feels safer to
people from the Hadoop world, Glue feels like the "right" AWS-native
answer to people newer to the stack, and both instincts are reasonable
but neither is automatically correct). If genuinely no constraint
forces the decision either way, I'd default to lift-and-shift first,
because it's more reversible — a bad EMR lift can still be modernized
later, but a stalled native rebuild under deadline pressure produces
nothing shipped at all.

### Q19. A stakeholder insists on keeping a legacy on-prem system running "just in case" for two years after a successful migration, doubling your ongoing infrastructure cost. How do you handle that?

I take the underlying risk aversion seriously rather than dismissing it
as pure cost-blindness — "just in case" usually means someone got
burned by a migration before, or doesn't yet trust the new system's
output, and that trust has to be earned with evidence, not overridden
by a cost argument. So I'd ask what specific event would make them
comfortable decommissioning — a clean quarter-end close with zero
discrepancies, a specific report matching for N consecutive cycles,
sign-off from a specific downstream owner — and get that criteria
written down explicitly rather than leaving "just in case" open-ended
forever, because open-ended risk aversion never resolves itself; it
just becomes permanent. Once the criteria exists, I'd track progress
against it visibly (a dashboard, a recurring status update) so the
conversation moves from "are we ready to turn it off" (a debate that
restarts from zero every time) to "we're at week 6 of the required 8
matching cycles" (a factual status update). I'd also make the ongoing
cost of the parallel run visible on a recurring basis, not just once,
so the trade-off stays real to the stakeholder rather than becoming an
invisible sunk cost line item — a monthly reminder of "keeping the old
system running currently costs $X/month; we're at week 6 of 8" does
more to accelerate a responsible decommission than any single argument
about cost alone.

### Q20. How do you know when a legacy system migration is actually "done," versus when the team has just quietly stopped talking about it while the old system still runs in the background?

I don't consider a migration done when the new system works — I
consider it done when the old system is *turned off*, because a legacy
system that's still running "just in case," with nobody actively
maintaining it, is a slow-motion incident waiting to happen: it'll fail
eventually, at the worst possible time, and whoever's on call that day
will have zero context because the team's attention moved on months
ago. So I track migrations against an explicit decommission date from
day one, not as an afterthought — the project isn't "migrate to AWS,"
it's "migrate to AWS *and* decommission the old system by [date]," and
I treat slipping that second half with the same seriousness as slipping
a feature deadline, because from an operational-risk standpoint it's
the more dangerous of the two to leave open. If a migration has quietly
stalled with the old system still live and nobody's actively tracking
why, that's a warning sign I raise explicitly rather than let ride —
usually it means either the validation criteria was never made
concrete (see Q19) or the team moved on to the next priority before
finishing, and either way it needs to be reopened as active work with
an owner and a date, not left as ambient background risk that
everyone's quietly hoping resolves itself.

---

## Cheat sheet — the four questions behind every senior answer

| Situation | The question that cuts through it |
|---|---|
| Build vs. buy / new service vs. extend | Who owns the 2 a.m. page for this, and for how long? |
| Ambiguous or "just in case" requirement | What specific decision does this requirement enable? |
| Cost conversation | What's the number, per unit of value, not per month? |
| Legacy / migration judgment | What's the actual risk of being wrong, and is it reversible? |

**Memory hook — "ORCA":** every senior-level answer above eventually
touches **O**wnership (who's accountable), **R**eversibility (how bad
if we're wrong), **C**ost (per unit of value, made visible), and
**A**lignment (does the fix match the actual constraint, not the
architectural preference in the room).
