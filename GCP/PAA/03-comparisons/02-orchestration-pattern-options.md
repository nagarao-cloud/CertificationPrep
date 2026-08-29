# Orchestration Patterns: Parallel vs. Sequential vs. Graph Workflow

**Exam mapping:** Task 3.3 (orchestrating and coordinating agentic
workflows), specifically: "Selecting and coordinating multi-agent
handoffs and workflows (e.g., **parallel agents, sequential agents, and
graph workflow**) using Google Cloud tools (e.g., Agent Identity, Agent
Registry, Agent Runtime, and agent policies)." All three pattern names
are verbatim from the guide — this is the only place multi-agent
*coordination shape* is named explicitly, so expect scenario questions
that describe a workflow shape in prose and ask you to name the pattern
(or pick the tool combination that implements it).

## 1. What each pattern is

- **Sequential agents.** Agents run one after another, each consuming
  the prior agent's output as its own input — a pipeline. Step 2 cannot
  start meaningfully before step 1 finishes, because step 2 depends on
  step 1's result.
- **Parallel agents.** Multiple agents run concurrently against the same
  or independent inputs, with no dependency between them until a later
  aggregation/merge step (if any). Used when sub-tasks are independent
  and you want wall-clock speed, or when you want multiple independent
  perspectives (e.g., multiple retrieval or reasoning paths) to combine
  or vote.
- **Graph workflow.** Agents are nodes in an explicit graph with
  conditional edges — the path taken depends on runtime state, not a
  fixed linear or fan-out/fan-in shape. This is the pattern for
  workflows with branching, loops, or conditional routing between
  agents (e.g., "if the classifier agent says X, route to agent A;
  if Y, route to agent B; retry node C up to N times").

All three are coordinated using the same underlying Google Cloud tool
set named in task 3.3: **Agent Identity** (per-agent identity/PAB for
each node in the workflow), **Agent Registry** (how one agent discovers
and invokes another as a capability), **Agent Runtime** (the deployment
target the coordinated agents run on — never "Agent Engine," the
retired name), and **agent policies** (governance rules that apply
across the handoff). The pattern you choose is a control-flow design
decision; the tooling underneath doesn't change based on which pattern
you pick.

## 2. Head-to-head comparison table

| Dimension | Sequential agents | Parallel agents | Graph workflow |
|---|---|---|---|
| Control flow | Fixed linear chain, A → B → C | Fan-out (all at once), optional fan-in merge | Conditional graph — branches, loops, dynamic routing |
| Dependency between agents | Strict — each step needs the prior step's output | None between parallel branches | Depends on the edge — some nodes wait on others, some don't |
| Latency profile | Sum of each agent's latency (slowest-path = total path) | Bounded by the *slowest* branch, not the sum — faster wall-clock for independent work | Variable — depends on which path executes, can include loops that add latency |
| Best for | Multi-step pipelines where each stage genuinely needs the last (e.g., retrieve → summarize → format) | Independent sub-tasks, ensemble/voting patterns, "ask 3 agents, merge the best answer" | Decision-driven workflows: routing, retries, human-in-the-loop branches, escalation paths |
| Failure handling | A failure at step N blocks everything downstream — needs explicit retry/fallback per step | One branch failing doesn't have to block the others; failure isolation is natural | Failure handling is a first-class part of the graph — a failed node can route to a retry or fallback node explicitly |
| Determinism | Fully deterministic order | Order of completion is non-deterministic; result composition must not assume arrival order | Path taken is state-dependent — same input can traverse different paths in different runs if state differs |
| Coordination complexity to build | Lowest — straightforward chaining | Medium — needs a merge/aggregation step and race-condition-safe composition | Highest — needs explicit state, edge conditions, and often cycle-detection/retry limits |
| Observability need | Trace one path start to end | Trace N concurrent branches + how they were merged | Trace which path was actually taken and why (which edge condition fired) |
| Typical Agent Runtime scaling shape | One agent instance active per stage at a time | Multiple agent instances active concurrently — higher peak resource draw | Variable — driven by which nodes are active on a given path |
| Example use case | Document ingestion pipeline: extract → chunk/embed → summarize → store | Multi-source research agent: query 3 data sources simultaneously, merge results | Customer support triage: classify → route to specialist agent or escalate to HITL based on confidence |

## 3. Decision tree

```
                What shape is the multi-agent workflow?
                                |
        Does each agent's work depend on the PRECEDING
        agent's output (can't start until prior finishes)?
                                |
                +---------------+---------------+
               YES                              NO
                |                                |
                v                                v
      Is there also conditional          Are the sub-tasks independent
      branching/looping based on         of each other (no ordering
      runtime state (retries,            requirement between them)?
      escalation, routing)?                       |
                |                          +-------+-------+
        +-------+-------+                 YES              NO
       NO               YES                |                |
        |                 |                v                v
        v                 v          Use PARALLEL      Re-examine the
  Use SEQUENTIAL   Use GRAPH          AGENTS (fan-out,  workflow — mixed
  agents (fixed    WORKFLOW           optional merge)   dependency graphs
  pipeline, task   (conditional                         are graph workflows,
  3.3)             edges, task 3.3)                     not sequential ones
```

## 4. Tradeoff writeups

### Use sequential agents when...
- Each stage's output is a genuine, required input to the next —
  extract-then-summarize, retrieve-then-generate, plan-then-execute. The
  ordering constraint is real, not incidental.
- You want the simplest possible coordination logic and the workflow
  has no branching or conditional logic to express — a straight pipeline
  is easier to build, trace, and debug than forcing it into a graph.
- Predictable, linear latency (sum of stages) is acceptable for the use
  case.

### Don't use sequential agents when...
- Sub-tasks are actually independent of each other — chaining them
  needlessly serializes work that could run concurrently, which is
  pure wasted latency. That's parallel agents' job.
- The workflow has real conditional branching (retry a step N times,
  escalate on low confidence, route based on a classifier's output) —
  forcing that into a strict linear chain either can't express the
  logic at all or requires bolting ad-hoc conditionals onto what should
  be a graph.

### Use parallel agents when...
- Sub-tasks are independent and wall-clock time matters — running
  three retrieval agents against three data sources simultaneously and
  merging is strictly faster than doing it sequentially.
- You want redundancy or an ensemble/voting effect — multiple agents
  attempting the same task from different angles, with the best or a
  merged result selected afterward.
- Failure isolation matters — one branch's failure shouldn't block the
  others from completing.

### Don't use parallel agents when...
- There's a real ordering dependency between the agents — running them
  concurrently would mean an agent starts before the input it needs
  actually exists. That's sequential agents' job.
- The workflow needs conditional routing based on results as they come
  in (not just a final merge) — plain fan-out/fan-in has no mechanism
  for one branch's outcome to change what another branch does mid-flight;
  that's what a graph workflow's edges are for.
- You need deterministic, reproducible ordering of side effects (e.g.,
  writes that must happen in a specific order) — concurrent agents give
  you non-deterministic completion order by default.

### Use graph workflow when...
- The workflow has genuine conditional logic: routing based on a
  classifier or confidence score, retry loops with a cap, escalation to
  a human-in-the-loop branch, or a mix of sequential and parallel
  sub-sections that themselves depend on runtime state.
- You need explicit, inspectable control over *which path was taken and
  why* — critical for debugging agent reasoning loops and system
  failures (this ties directly into task 4.2's troubleshooting
  considerations: drift, reasoning loops, and system failures are far
  easier to diagnose against an explicit graph than an implicit chain).
- The workflow is expected to evolve — a graph's explicit edges are
  easier to extend with a new branch than restructuring a hardcoded
  sequential/parallel pipeline.

### Don't use graph workflow when...
- The actual workflow is a strict pipeline or a simple fan-out with no
  real branching — modeling it as a graph adds state-management and
  cycle-detection overhead for no behavioral benefit over the simpler
  pattern. Reach for sequential or parallel first; only escalate to a
  graph when the guide's own trigger — actual conditional handoffs —
  is present.
- The team can't yet observe/trace which edge fired at runtime — a graph
  without strong observability (Cloud Logging/Cloud Trace on each node
  and edge decision) is harder to debug than a simpler pattern, not
  easier, because failures can hide inside untraced branch logic.

## 5. How they compose

These are not mutually exclusive within one system — a graph workflow's
nodes can themselves *be* sequential sub-pipelines or parallel fan-outs.
A common composite: a graph-level router agent decides which of several
subsystems to invoke; one branch is a sequential extract → summarize
pipeline; another branch is a parallel multi-source retrieval fan-in.
The pattern names in task 3.3 describe **local coordination shape**, not
mutually exclusive global architectures — a real production system
(see `04-architectures/` for the full multi-agent pattern) typically
nests these.

## 6. Exam traps to watch for

- A scenario that says "run these three retrieval calls at the same
  time and combine the results" is parallel agents, not a graph
  workflow — there's no conditional routing, just fan-out/fan-in.
- A scenario that says "if the confidence score is low, retry; if it's
  still low after 3 tries, escalate to a human" is a graph workflow
  (conditional edges + a HITL branch), not sequential agents, even
  though it superficially reads step-by-step.
- Don't assume Agent Runtime scaling behavior differs by pattern name —
  the guide ties Agent Runtime to task 4.2 (deployment runtime
  selection), not to which orchestration pattern is chosen; scaling
  is a deployment-layer decision layered underneath whichever
  orchestration pattern you pick (see
  `04-agent-hosting-deployment-options.md`).
- Remember Agent Runtime is the current name — never write "Agent
  Engine" when describing where these coordinated agents actually run.
