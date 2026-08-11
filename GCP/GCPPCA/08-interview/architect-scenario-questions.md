# Interview-Level Scenario Questions

> Beyond the multiple-choice exam format — open-ended architecture
> discussion questions of the kind a Cloud Architect interview panel
> asks, using this folder's material as the answer's foundation. Each
> includes a model answer structure, not a single "correct" sentence —
> real interview answers should be dialogues, not monologues.

---

## Q1. "Walk me through how you'd design a globally available
e-commerce platform from scratch on GCP."

**What a strong answer covers, in order:**

1. **Clarify requirements first** (Domain 1 §1.1/§1.2): ask about
   actual user geography, availability target (get a number), budget,
   compliance scope (PCI-DSS if handling cards directly), and existing
   team capability — don't design in a vacuum.
2. **Compute/network shape**: Global External Application LB + Cloud
   Armor + Cloud CDN at the edge, regional GKE Autopilot or Cloud Run
   app tiers behind it (`04-architectures/pattern-multi-region-web-app.md`).
3. **Data layer, justified by the actual consistency need**: don't
   default to Spanner — walk through whether inventory/checkout
   genuinely needs global strong consistency (probably yes for
   inventory counts) versus what can be regional/eventually consistent
   (product catalog, browsing history) — demonstrates Tree 2 reasoning,
   not a memorized answer.
4. **Security**: PCI-DSS scope isolation via VPC-SC perimeter around
   payment-processing components specifically, CMEK on customer data,
   Cloud Armor WAF rules.
5. **Reliability**: pick an HA/DR tier matched to a stated RTO/RPO
   (Tree 5), not the most expensive tier by default.
6. **Cost**: mention CUDs for the steady baseline, autoscaling for
   variable load, and that cost is a real constraint but not the only
   one.

**What separates a strong answer from a weak one:** a weak answer lists
services. A strong answer explains *why* each choice was made against a
specific stated (or explicitly assumed-and-flagged) constraint, and
proactively surfaces tradeoffs the interviewer didn't ask about (e.g.
"I'd want to know if you need PCI compliance before finalizing the
payment path's isolation boundary").

---

## Q2. "A junior engineer on your team wants to put every service
behind Cloud Spanner because 'it's the most advanced database.' How do
you respond?"

**Model answer structure:**

- Acknowledge the instinct isn't unreasonable — Spanner genuinely is
  GCP's most capable relational database.
- Explain the actual decision criteria: does this specific workload
  need *both* SQL semantics *and* global horizontal write scale with
  strong consistency? If not, a simpler, cheaper option (Cloud SQL,
  Firestore, Bigtable depending on shape) is the better engineering
  choice, not a worse one.
- Use this as a teaching moment about the over-engineering trap
  (`00-START-HERE/EXAM-TRAPS-AND-MNEMONICS.md` #1) — "most advanced"
  and "most correct for this requirement" are frequently different
  answers, and recognizing that distinction is a core architect skill,
  not just an exam trick.
- Concretely: walk through Tree 2 together with the junior engineer for
  their actual workload.

---

## Q3. "Tell me about a time you had to choose between a fast,
imperfect solution and a slower, more correct one. How did you
decide?"

**Model answer structure (STAR-shaped, grounded in this folder's
material):**

- **Situation**: frame a scenario resembling Domain 1 §1.4's migration
  tradeoffs — e.g. a hard deadline forcing a Rehost when a Refactor
  would have been architecturally cleaner.
- **Task**: the actual constraint that made this a real decision, not
  an obvious one (e.g. data-center lease expiring in 6 weeks).
- **Action**: explain the reasoning — deadline was the binding
  constraint (Domain 1 exam trap), so Rehost was chosen deliberately,
  with a documented plan to Replatform/Refactor incrementally
  afterward rather than treating the lift-and-shift as a permanent
  end-state.
- **Result**: met the deadline; quantify the follow-up modernization
  work if possible, showing the "imperfect now, better later" tradeoff
  was managed deliberately, not abandoned.

---

## Q4. "How would you convince a stakeholder that a cheaper
architecture is actually the right choice, when they associate 'more
expensive' with 'more reliable'?"

**Model answer structure:**

- Reframe the conversation around the *stated* RTO/RPO or SLA target,
  not vague notions of "reliable" (Domain 1 §1.2's requirement-
  translation skill, applied in a stakeholder conversation).
- Use Tree 5 (`00-START-HERE/DECISION-TREES.md`) as a walkthrough tool:
  show the stakeholder that a Warm Standby tier meeting their actual
  stated RTO/RPO costs meaningfully less than Active-Active, and ask
  them to confirm the RTO/RPO number is really what they need before
  defaulting to the most expensive tier.
- Acknowledge that sometimes the stakeholder genuinely does need the
  expensive tier — the point isn't to always argue for cheaper, it's to
  make the tradeoff explicit and let the actual requirement (not
  intuition) drive the decision.

---

## Q5. "Describe how you'd design telemetry ingestion for millions of
intermittently-connected IoT devices."

**Model answer structure**, drawing directly on
`04-architectures/case-study-terramearth.md`:

1. Pub/Sub as the durable, elastic ingest buffer — absorbs bursty
   arrival without requiring devices to be continuously online.
2. Dataflow with watermarks/triggers explicitly configured for
   late-arriving data — call out that default windowing would silently
   drop data from the worst-connected (often most valuable-to-monitor)
   devices.
3. Bigtable for raw telemetry with a deliberately salted/hashed row
   key — explain *why* (avoid hotspotting despite low per-device
   frequency, because the aggregate fleet-wide write pattern still
   concentrates on "currently reporting" ranges).
4. BigQuery for aggregated/curated data feeding a Vertex AI predictive-
   maintenance model — tie the pipeline to an actual business outcome,
   not just "store the data."

**What this question is really testing:** whether the candidate treats
IoT/telemetry design as a generic "big data pipeline" problem or
recognizes the specific characteristics (intermittent connectivity,
massive device count, low per-device but high aggregate write rate)
that should shape the design differently from, say, a steady
continuous-stream use case.

---

## Q6. "When would you recommend *against* using Kubernetes at all?"

**Model answer structure:**

- If the workload is a stateless HTTP service with no need for
  Kubernetes-specific orchestration features, Cloud Run gets the same
  outcome with far less operational surface — recommend GKE only when
  something in the requirement actually needs it (existing team
  expertise, complex multi-container orchestration, specific
  scheduling/affinity needs, portability across clouds via a portable
  API).
- This demonstrates the same principle tested throughout
  `03-comparisons/01-compute-options.md` — match the tool to the
  requirement, don't default to the most powerful/complex option
  because it's more impressive to have built.
