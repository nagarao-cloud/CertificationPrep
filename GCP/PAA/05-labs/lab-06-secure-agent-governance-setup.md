# Lab 06 — Securing and governing the agent platform: OAuth2, PAB, Agent Gateway, Model Armor, HITL

> Covers exam task **5.1** (configuring agent security and governance)
> and **5.2** (implementing secure agent behavior and execution).
> Wraps a governance layer around everything built in Labs 03–05.
> Companion reference: `01-domains/SECTION-5-secure-govern.md`,
> `02-services/06-security-governance.md`,
> `03-comparisons/06-security-governance-models.md`.

---

## Honesty callout

> **This lab is illustrative, not console/SDK-verified.** This
> environment has no live access to Auth Manager, Agent Identity, PAB
> policy configuration, Agent Gateway, Model Armor, Sensitive Data
> Protection, Skill Registry, or any Google Cloud console. Code and
> config samples below are realistic illustrations built from the exam
> guide's stated capabilities, not verified against real SDK/console
> output. **Confirm exact syntax and console flows against live
> documentation before an exam attempt.**

---

## 0. Why this lab wraps around, rather than replaces, everything before it

Recall the framing from `01-domains/SECTION-5-secure-govern.md` §0:
Section 5 doesn't introduce new agent-*building* capability — it
constrains, authenticates, monitors, and gates the capability already
built in Sections 1–4. This lab does not touch the triage, drafting,
or specialist agents' core logic from Labs 03–04 at all; it adds
security/governance configuration *around* them.

### Vocabulary check before you start

*(Per this folder's `CLAUDE.md` §8, OAuth 2.0 is treated as general
vocabulary you're expected to know — it's not re-explained from
scratch here, only its agent-specific application is. Everything else
below is defined fresh.)*

- **Authentication** — proving *who* (or *what*, for a non-human
  principal like an agent) is making a request.
- **Authorization** — determining *what* an already-authenticated
  principal is allowed to do.
- **Principal** — the entity performing an action in a security
  context — traditionally a human user or a service account; in this
  section, an agent itself is treated as a principal.
- **Guardrail** — a control that constrains an agent's behavior or
  output to stay within acceptable bounds, as a safety net independent
  of whether the agent's underlying reasoning was "correct."
- **PII (personally identifiable information)** — data that can
  identify a specific individual (name, email, SSN, phone number,
  etc.) — a category of data that typically carries extra handling/
  protection requirements.

---

## 1. Part A — OAuth 2.0 agent-to-tool authentication via Auth Manager (task 5.1)

### 1.1 Why static, embedded credentials are the wrong default

Recall from `01-domains/SECTION-5-secure-govern.md` §1.1: the specific
exam-tested application here is **agent-to-tool** API authentication
— an agent acting as the client, authenticating to a tool/API it needs
to call. You already saw a version of this concern in Lab 02 §2.2
(the MCP server config referencing a token via environment variable,
not a literal secret) — this lab formalizes it properly through **Auth
Manager**.

### 1.2 Configure Auth Manager for the specialist agent's tool access

```python
from adk.auth import AuthManager, OAuthScope

specialist_tool_auth = AuthManager.configure(
    agent=specialist_agent,   # from Lab 04
    tool="ticketing-system-api",
    flow="oauth2_client_credentials",
    scopes=[
        OAuthScope("tickets:read"),
        OAuthScope("tickets:comment"),
        # deliberately NOT requesting tickets:delete or
        # tickets:admin — the specialist agent never needs them
    ],
    token_lifetime_seconds=900,  # short-lived — 15 minutes
)
```

**Reasoning behind both the scope list and the short
`token_lifetime_seconds`, not just the mechanism:** this is the exact
don't-use/use guidance from
`01-domains/SECTION-5-secure-govern.md` §1.1 — "don't use long-lived,
broadly-scoped static credentials... use OAuth 2.0-based, appropriately
scoped, token-based authentication." Two separate design choices are
doing work here: the **scope list** limits *what* the token can do
even if it were somehow misused (least-privilege at the permission
level), and the **short lifetime** limits *how long* a compromised or
leaked token would remain useful (defense-in-depth at the time
dimension) — these are complementary controls, not redundant ones.

---

## 2. Part B — configure PAB policies via Agent Identity (task 5.1)

### 2.1 The distinction that matters most in this whole lab

Recall the currency correction from
`01-domains/SECTION-5-secure-govern.md` §1.2: **PAB (principal access
boundary) is a specific, named, agent-focused mechanism, configured
through Agent Identity — not a generic IAM role.** A PAB policy is a
*boundary*, not a grant: it caps the maximum scope any permission an
agent holds can ever reach, even if some other misconfiguration tried
to grant broader access. You already used `AgentIdentity` in Labs 03–04
to scope *allowed/denied data sources* — this lab extends that into a
formal PAB policy covering the agent's full effective boundary, not
just data-source access.

### 2.2 Define PAB policies for all three agents

```python
from adk.identity import PABPolicy

triage_pab = PABPolicy(
    agent=triage_agent,               # Lab 03
    max_data_sources=["gs://retail-co-kb/product-manuals/"],
    max_tools=["kb_lookup"],
    max_actions=["classify"],          # cannot draft, cannot escalate,
                                        # cannot touch tickets directly
)

drafting_pab = PABPolicy(
    agent=drafting_agent,             # Lab 03
    max_data_sources=["gs://retail-co-kb/product-manuals/"],
    max_tools=["kb_lookup", "a2a_handoff"],
    max_actions=["draft_response"],    # explicitly NOT issue_refund —
                                        # see Lab 03 §4's agent-vs-
                                        # human mode setting
)

specialist_pab = PABPolicy(
    agent=specialist_agent,           # Lab 04
    max_data_sources=[
        "gs://retail-co-kb/product-manuals/",
        "gs://retail-co-kb/specialist-policies/",
    ],
    max_tools=["kb_lookup", "ticketing-system-api"],
    max_actions=["resolve_dispute", "apply_policy_exception"],
)
```

**Why this is a boundary, not just a bigger allow-list, and why that
distinction is checkable:** imagine a future engineer, working under
time pressure, accidentally widens the *drafting agent's* MCP tool
configuration (Lab 02-style) to include the ticketing system's admin
API — a plausible real mistake. Without a PAB policy, that
misconfiguration would silently grant the drafting agent access it was
never supposed to have. **With** the `drafting_pab` policy above
capping `max_tools` to `["kb_lookup", "a2a_handoff"]`, that same
misconfiguration would be blocked at the boundary layer regardless of
what the tool-level configuration says — this is precisely what "a PAB
policy still constrains the effective boundary even if some other
misconfiguration tried to grant broader access" means in practice, not
just in the abstract definition from the domain file.

### 2.3 Don't share one PAB policy across agents

Notice each agent above got its own distinct `PABPolicy`, matched to
that specific agent's actual task — not one shared, broad policy
applied uniformly "for convenience." This is the direct don't-use/use
guidance from `01-domains/SECTION-5-secure-govern.md` §1.2: "don't use
a single shared, maximally-broad PAB policy across every agent...
that reintroduces exactly the blast-radius risk... use a distinct,
minimally scoped PAB policy per agent." If you're tempted to
consolidate these three policies into one shared config to reduce
boilerplate, resist it — the whole point of per-agent scoping is that
the triage agent (which only classifies) has no legitimate reason to
ever hold the specialist agent's dispute-resolution or ticketing-API
access, and a shared policy would erase that distinction.

---

## 3. Part C — configure Agent Gateway for traffic monitoring (task 5.1)

### 3.1 What Agent Gateway adds that PAB doesn't

Recall the layer-comparison table from
`01-domains/SECTION-5-secure-govern.md` §1.3: PAB/Agent Identity
answers *what is this agent allowed to do, at most* (a boundary
defined in advance); **Agent Gateway** answers *what is this agent
actually doing, right now and historically* (observed traffic). These
are complementary, not substitutes — don't configure one and assume
it covers the other's job.

```python
from adk.gateway import AgentGateway

gateway = AgentGateway.configure(
    agents=[triage_agent, drafting_agent, specialist_agent],
    log_destination="cloud-logging",   # ties into Lab 05 §4.2's
                                        # observability setup
    anomaly_detection=True,
    alert_on=[
        "call_volume_spike",
        "unexpected_destination",       # e.g. an agent suddenly
                                         # calling a tool/endpoint
                                         # it's never called before
        "pab_boundary_denial",          # a PAB policy actively
                                         # blocked something — worth
                                         # knowing about even though
                                         # it worked as designed
    ],
)
```

**Why `pab_boundary_denial` is in the alert list, even though a denial
means the PAB policy did its job correctly:** a single denial event
might just be the misconfiguration scenario from §2.2 getting caught
harmlessly — but a *pattern* of repeated denials against the same
boundary is a meaningful signal worth a human's attention: either
something is repeatedly misconfigured (worth fixing at the source) or
something is repeatedly attempting access it shouldn't (worth
investigating as a possible compromise or bug in the calling agent's
own logic). Agent Gateway's value here is exactly this kind of
visibility that a purely preventive control (PAB alone) doesn't give
you — PAB stops the bad access, Agent Gateway tells you it happened
and how often.

---

## 4. Part D — governance and policy enforcement: Agent Registry and Model Armor (task 5.1)

### 4.1 Agent Registry as a governance control, not just discovery

You've been using Agent Registry since Lab 03 (§7) purely as a
discovery/reuse mechanism. Recall from
`01-domains/SECTION-5-secure-govern.md` §1.4: it also has a governance
dimension — what gets registered (and by extension, what's
discoverable/reusable) should itself be subject to review, not an
unmoderated free-for-all.

```python
from adk import AgentRegistry

AgentRegistry.set_registration_policy(
    require_review=True,
    reviewers=["platform-security-team"],
)
```

**Why this matters concretely:** without a registration review policy,
any engineer could register a new "capability" — say, a hastily
built tool with overly broad ticketing-system access — and it would
immediately become discoverable and reusable by every other agent in
the organization, including the fictional company's triage and
drafting agents, which per §2.2's PAB policies were never supposed to
reach ticketing-system admin functions. Requiring review before
registration is what keeps the catalog itself trustworthy, not just
the individual agents' PAB policies.

### 4.2 Configure Model Armor for content-safety screening

```python
from adk.safety import ModelArmor

model_armor = ModelArmor.configure(
    agents=[drafting_agent, specialist_agent],
    screen_inputs=True,   # catch prompt-injection-style attacks
                           # hidden in retrieved documents or user
                           # messages before they reach the LLM
    screen_outputs=True,  # catch unsafe/policy-violating content
                           # before it reaches the end user
    policy="enterprise-support-default",
)
```

**Why screen *inputs*, not just outputs, in a RAG-grounded agent
specifically:** this is a genuinely important, easy-to-miss point for
a RAG system like this lab's. The drafting and specialist agents don't
just receive user messages as input — they also receive **retrieved
document content** (from Vector Search 1.0, Lab 03 §5) as part of
their prompt context. If an attacker could get malicious instructions
embedded into a document that later gets ingested and retrieved (a
real, named category of risk — prompt injection via retrieved
content), input-side screening is what has a chance of catching it
before those hidden instructions ever reach the LLM's reasoning.
Screening only the final output would miss an attack that
successfully manipulated the agent's *behavior* mid-execution (e.g.,
convincing it to call a tool it shouldn't) without necessarily
producing an obviously unsafe final text output.

### 4.3 Add Sensitive Data Protection for a distinct risk category

Per `02-services/06-security-governance.md`'s explicit three-way
comparison (Model Armor vs. Sensitive Data Protection vs. HITL — see
§4.2's note there): these guard against **different** things and are
used together, not as substitutes.

```python
from adk.safety import SensitiveDataProtection

sdp = SensitiveDataProtection.configure(
    agents=[drafting_agent, specialist_agent],
    detect=["email", "phone_number", "credit_card", "ssn"],
    action="redact_before_logging",
)
```

**Why this is a separate control from Model Armor, not a duplicate:**
Model Armor asks "is this content safe/policy-compliant" (e.g., is
someone trying a prompt-injection attack, or is the output toxic).
Sensitive Data Protection asks a narrower, different question: "does
this content contain a customer's PII that shouldn't be logged in
plaintext or exposed where it doesn't belong" — a customer's real
support message legitimately contains their order number and possibly
their email address; that content isn't "unsafe" in Model Armor's
sense at all, but it still needs to be handled carefully (e.g.,
redacted before being written to a log that a broader set of engineers
can read). Configuring only one of these two tools leaves a real gap:
Model Armor alone wouldn't catch a legitimate but sensitive message
being over-logged; Sensitive Data Protection alone wouldn't catch a
malicious instruction hidden in an otherwise "clean-looking" (no PII)
piece of retrieved content.

---

## 5. Part E — configure a HITL gate for high-risk actions (task 5.2)

### 5.1 Which actions actually need a human checkpoint

Recall from `01-domains/SECTION-5-secure-govern.md` §2.1: HITL should
be applied selectively, gated on an action's actual stakes/
reversibility — not to every action indiscriminately (which eliminates
the efficiency benefit of autonomy) and not skipped entirely for
high-stakes actions either. Walk this system's actual action list and
classify each one, out loud, before writing config:

| Action | Reversible? | Stakes | HITL required? |
|---|---|---|---|
| `kb_lookup` (read-only retrieval) | Yes (no side effect) | Low | No |
| `draft_response` (produce text, not yet sent) | Yes (still reviewable) | Low-medium | No |
| `a2a_handoff` (route to specialist) | Yes (an internal routing step) | Low | No |
| `apply_policy_exception` (grant a non-standard exception) | Partially — hard to fully undo customer-facing commitment | High | **Yes** |
| `issue_refund` (from Lab 03 §4) | No — money moves | High | **Yes** |

### 5.2 Configure the gate

```python
from adk.safety import HITLGate

hitl = HITLGate.configure(
    agent=specialist_agent,
    gated_actions=["apply_policy_exception", "issue_refund"],
    approval_channel="support-team-review-queue",
    timeout_behavior="hold_and_notify",  # do NOT default to
                                          # auto-approve on timeout
)
```

**Why `timeout_behavior="hold_and_notify"`, not an auto-approve
fallback:** this is a small but exam-relevant design detail worth
reasoning through explicitly. If a human reviewer doesn't respond in
time, the *safe* failure mode for a high-stakes, hard-to-reverse
action is to keep waiting (and escalate the notification) — **not** to
silently proceed as if approved. Defaulting to auto-approve on timeout
would completely defeat the purpose of the HITL gate: it would turn a
supposedly human-gated action into an autonomous one under exactly the
condition (no human available) where oversight matters most.

### 5.3 Verify the gate composes correctly with everything else in this lab

Trace one example end to end, the same way Lab 04 §7 traced a
handoff: a ticket requiring `apply_policy_exception` arrives at the
specialist agent. Before the HITL gate is even reached, the request
has already passed through: **Auth Manager** (if it needed to call an
external tool), the specialist agent's **PAB policy** (confirming
`apply_policy_exception` is within its `max_actions`), **Agent
Gateway** (logging the attempt), and **Model Armor** (screening the
input/output content). The **HITL gate** is the last layer, and it's
specifically about the *action's* real-world consequence, not a
substitute for any of the layers before it — per
`01-domains/SECTION-5-secure-govern.md` §2.1's explicit warning:
"don't use Model Armor screening alone as a complete safety framework
for high-stakes actions... content-safety screening... doesn't
substitute for a human judgment checkpoint on whether a specific
action... should actually execute." All of these layers apply to the
same single action simultaneously — they are not alternatives to
choose between.

---

## 6. Part F — identity propagation across the whole multi-hop system (task 5.2)

Recall from `01-domains/SECTION-5-secure-govern.md` §2.2: in a
multi-hop system (exactly what Labs 03–04 built — triage → draft →
A2A handoff → specialist → ticketing-system API call), the
*originating* identity/permission context needs to be correctly
carried through each hop, rather than each hop defaulting to its own
broad service identity.

```python
from adk.identity import propagate_identity

@propagate_identity(bounded_by="pab_policy")
def handle_ticket(original_request):
    triage_result = triage_agent.classify(original_request)
    draft = drafting_agent.draft(original_request, triage_result)
    if should_escalate(triage_result, draft.confidence):
        # identity propagates to the specialist agent's OWN PAB-
        # bounded scope — never expanded at this hop, only ever
        # bounded further if anything
        return specialist_agent.resolve(draft, original_request)
    return draft
```

**Why "never expanded at this hop, only ever bounded further" is the
correct direction, and why this connects everything in this lab
together:** this single sentence is the synthesis of nearly every
control built in this lab. Each hop's effective access is the
*intersection* of (a) whatever the originating request's context
carried and (b) that specific agent's own PAB boundary (§2) — never
the union of the two, and never expanded just because a later agent
in the chain happens to have broader permissions available for its
*other* work. This is the concrete mechanism-level answer to Lab 04
§2's identity-scoping guidance, now generalized across the whole
system rather than just the one A2A handoff — and it's visible/
auditable specifically because Agent Gateway (§3) is tracking the
actual propagated calls at every hop.

---

## 7. What you should be able to explain after this lab

- [ ] Why agent-to-tool authentication should use short-lived, scoped
      OAuth 2.0 tokens via Auth Manager instead of long-lived static
      credentials (task 5.1).
- [ ] What a PAB policy actually is — a boundary, not a grant — and a
      concrete example of how it would catch a misconfiguration that
      a tool-level access setting alone would have missed (task 5.1).
- [ ] Why each agent in this lab has its own distinct PAB policy
      instead of one shared policy (task 5.1).
- [ ] What Agent Gateway adds beyond what PAB/Agent Identity already
      provides, and why a *pattern* of PAB denials is worth alerting
      on even though each individual denial "worked as designed"
      (task 5.1).
- [ ] Why Agent Registry's registration step needs a review policy,
      not just a discovery mechanism, once you're thinking about it as
      a governance control (task 5.1).
- [ ] The three-way distinction between Model Armor (content safety),
      Sensitive Data Protection (data sensitivity), and HITL (action
      risk) — with a concrete example of a risk each one catches that
      the other two would miss (task 5.1/5.2).
- [ ] Why input screening matters specifically for a RAG-grounded
      agent, not just output screening (task 5.2).
- [ ] How to classify a given action's reversibility/stakes to decide
      whether it needs a HITL gate, using this lab's action table as a
      worked example (task 5.2).
- [ ] Why a HITL gate's timeout behavior should hold-and-notify rather
      than auto-approve (task 5.2).
- [ ] What identity propagation means across a multi-hop system, and
      why "bounded further, never expanded" is the correct direction
      at every hop (task 5.2).
