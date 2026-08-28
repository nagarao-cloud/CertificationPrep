# Section 1 — additional practice questions (15)

> Building agents using low-code tools (~13% of the exam). These 15
> questions are **additional** to the 18 already at the end of
> `01-domains/SECTION-1-low-code-tools.md` — different scenarios, no
> wording overlap. Every option is explained, correct and incorrect
> alike, so there is no separate answer key to drift out of sync.

**Q1.** An insurance company wants a claims-intake agent that collects
a policy number, incident date, and incident type across several
turns, branches into different follow-up questions depending on
incident type, and must never let a user submit without all required
fields. Which low-code builder fits this requirement?
A) Agent Designer, because it is the general-purpose default
B) CX Agent Studio, because the requirement needs explicit multi-page
   state, conditional branching, and parameter-completeness gating
C) Either tool works identically for this use case
D) Neither — this requires a custom ADK agent

*Answer: B.* Multi-step collection with branching-by-value and a hard
gate on required fields is exactly the state-based (pages, transition
routes, event handlers) model CX Agent Studio provides. (A) Agent
Designer is the better fit for simpler, less structurally branchy
agents — not this one. (C) is false; the tools have different design
paradigms, they are not interchangeable for this requirement. (D)
overreaches — this is squarely a low-code CX Agent Studio use case,
not a signal to jump to custom code.

**Q2.** A retail brand wants every response from its Gemini Enterprise
agent to consistently use a specific friendly, concise tone and to
never discuss competitor pricing, across every single turn of every
conversation. Where should this be configured?
A) A single transition route with a tone condition
B) A system instruction defining the persistent behavioral/tone
   contract
C) A one-time few-shot example shown only on the first turn
D) An event handler for no-match

*Answer: B.* Tone and scope constraints that must hold across the
entire conversation, not just one output format, belong in system
instructions — the persistent top-level contract. (A) transition
routes fire on matched intent/condition, not as an always-on tone
constraint. (C) few-shot examples shape output structure for a given
prompt, not a persistent cross-turn behavioral rule, and "shown only on
the first turn" wouldn't propagate anyway. (D) event handlers respond
to system events like no-match/no-input, unrelated to tone.

**Q3.** A CX Agent Studio flow calls a backend webhook to look up order
status. The webhook occasionally times out or returns a 500 error.
What should handle this gracefully instead of the conversation simply
stalling?
A) A transition route with a very broad catch-all intent
B) A webhook-error event handler routing to a fallback message or
   retry path
C) A system instruction telling the model to "handle errors politely"
D) Increasing the number of few-shot examples

*Answer: B.* A webhook failure is a system event, not a matched user
intent — exactly what event handlers exist to catch, with a dedicated
webhook-error handler type. (A) transition routes need a matched
intent/condition; a backend failure isn't one. (C) relies on
instruction-following for something that should be a structural,
deterministic fallback. (D) few-shot examples shape output format, not
error-handling behavior.

**Q4.** A legal team has thousands of scanned (image-only, no
selectable text layer) contract PDFs they want a Gemini Enterprise
agent to answer questions about. Simply connecting the folder to Agent
Search will not make this content retrievable. What is required first?
A) Nothing — Agent Search retrieves any file type automatically with
   no preprocessing
B) The scanned documents must go through ingestion/processing (e.g.,
   text extraction from the image content) before their content is
   indexable and groundable
C) Scanned PDFs cannot ever be used with Gemini Enterprise
D) The documents must be converted to video format first

*Answer: B.* This is the same principle task 1.2 states for unstructured
multimodal data generally: ingestion/processing must happen before
retrieval is possible, and a scanned-image PDF is functionally
image-only content until it is processed into indexable text. (A) is
false and the exact misconception this tests — connecting storage
alone doesn't create a retrievable index. (C) is false — the guide
explicitly covers ingesting images into agentic workflows. (D) is
nonsensical.

**Q5.** A task requires an agent to produce output that both follows a
strict multi-field JSON schema *and* correctly reasons through several
interacting business rules before filling in the fields. Which
in-console prompting combination is most appropriate?
A) Chain-of-thought only, since reasoning is the harder problem
B) Few-shot only, since the schema is the harder problem
C) Both chain-of-thought (for the multi-step reasoning) and few-shot
   (to pin the exact JSON structure), since they solve different
   problems
D) Neither is needed if the system instruction is long enough

*Answer: C.* Chain-of-thought and few-shot prompting address different
failure modes — reasoning depth versus output-structure fidelity — and
this scenario has both problems at once, so both techniques are
appropriate together. (A) leaves the schema under-specified. (B)
leaves the multi-step reasoning unaddressed. (D) is the anti-pattern
called out elsewhere in this folder: relying purely on instruction
length/persistence for problems that have purpose-built techniques.

**Q6.** A solutions consultant tells a client: "Google's low-code
agent platform is called Vertex AI Agent Builder." Is this accurate
for the PAA exam?
A) Yes, that is the platform's correct current name
B) No — that branding does not appear in the exam guide at all; the
   actual low-code platform is Gemini Enterprise, built with Agent
   Designer and CX Agent Studio
C) Yes, but only for agents that don't use CX Agent Studio
D) No — the correct name is Agent Runtime

*Answer: B.* This is a direct currency trap: "Vertex AI Agent Builder"
is a commonly-searched but outdated/incorrect name for this exam —
Gemini Enterprise is the guide's actual platform name. (A) and (C) both
accept the wrong branding. (D) confuses this with a completely
different tool — Agent Runtime is the Section 3/4 managed deployment
environment for custom agents, not a low-code platform name.

**Q7.** In a CX Agent Studio flow, a transition route out of an
"Order Summary" page should only fire once the collected `order_total`
parameter exceeds a threshold that triggers a manager-approval step.
How is this correctly configured?
A) A system instruction telling the model to check the total itself
B) A transition route gated on a condition referencing the
   `order_total` parameter value
C) An event handler for no-input
D) This cannot be done without custom code

*Answer: B.* Transition routes can be gated on conditions over
collected parameters, not just matched intent — exactly the structural
mechanism for value-based branching like a threshold check. (A) relies
on unreliable instruction-following for a hard business rule that
should be deterministic. (C) no-input handlers fire on user silence,
unrelated to a parameter-value condition. (D) is false — this is a
native, no-code CX Agent Studio capability.

**Q8.** A CX Agent Studio page has both a page-level no-match event
handler and the containing flow has a flow-level no-match event
handler. A user's utterance on that page fails to match any intent.
Which handler applies?
A) Both fire simultaneously and their responses are merged
B) The more specific, page-level handler takes precedence over the
   broader flow-level handler
C) The flow-level handler always takes precedence regardless of page
   scope
D) Neither fires; only transition routes can respond to unmatched
   utterances

*Answer: B.* This follows the same specificity principle used
elsewhere in CX Agent Studio (e.g., specific routes over broad
catch-alls): a page-scoped handler is more specific to the current
context and takes precedence over a flow-wide default. (A) is a
fabricated merge behavior. (C) inverts the correct precedence. (D) is
false — no-match is precisely what event handlers (not transition
routes) are for.

**Q9.** A small business wants a simple, single-turn FAQ agent grounded
on one static product manual — no multi-step data collection, no
branching based on prior answers. Which low-code approach is the best
fit, and why?
A) CX Agent Studio, because state machines are always the safer choice
B) Agent Designer, since the use case has no structural need for
   pages, transition routes, or event handlers
C) A custom ADK agent, since low-code tools can't ground on a PDF
D) CX Agent Studio, because Agent Search requires it

*Answer: B.* No branching, no multi-turn state to track — Agent
Designer's simpler, non-state-machine model fits without the overhead
CX Agent Studio's structure would add for no benefit. (A) overgeneralizes;
more structure isn't automatically better when the use case doesn't
need it. (C) is false — grounding a single document is a textbook
low-code Agent Search use case. (D) is false — Agent Search can be
connected from either builder.

**Q10.** A company worries its low-code agent might answer confidently
using the underlying Gemini model's general training knowledge instead
of their proprietary, frequently-changing internal policy documents.
What should they verify is properly configured to prevent this?
A) Chain-of-thought prompting strength
B) That the agent is actually grounded via Agent Search against the
   current policy documents, rather than relying on ungrounded model
   knowledge
C) The number of few-shot examples in the system instruction
D) The page/transition route structure in CX Agent Studio

*Answer: B.* This is precisely what Agent Search's retrieval-grounding
role addresses — answers sourced from the connected proprietary data
rather than the model's static training knowledge. (A) and (C) are
prompting techniques that shape reasoning/format, not grounding source.
(D) is a CX Agent Studio structural concept, unrelated to whether
answers are grounded in real data.

**Q11.** A growing startup's low-code agent has accumulated so many
overlapping transition routes, nested conditions, and cross-page state
dependencies that the team can no longer reliably predict its
behavior. What does this situation most directly suggest, per the
low-code-vs-custom-code framing used throughout this folder?
A) Nothing — add more transition routes until it works
B) The use case may have outgrown low-code tooling's sweet spot and is
   a candidate for evaluation against a custom ADK-based agent
   (Section 3), where explicit code offers more predictable control
C) Switch immediately to CX Agent Studio from Agent Designer
D) This is a sign Agent Search is misconfigured

*Answer: B.* Low-code tools are the right fit until structural
complexity outgrows what a state machine can cleanly express — at that
point, the same "match the tool to actual need" principle that favors
low-code for simple cases points toward custom code for genuinely
complex orchestration. (A) doubles down on the underlying problem. (C)
doesn't address complexity — CX Agent Studio *is* the state-machine
tool already in use. (D) misdiagnoses a design-complexity problem as a
grounding-configuration problem.

**Q12.** Which statement correctly relates "Gemini Enterprise" and
"Gemini LLMs" as both appear in the exam's in-scope tool list?
A) They are the same item listed twice under different names
B) Gemini Enterprise is the low-code platform (Agent Designer, CX
   Agent Studio) that is built on top of and configures behavior for
   the underlying Gemini LLM family — platform versus the model layer
   it orchestrates
C) Gemini LLMs are exclusively used by custom ADK agents, never by
   Gemini Enterprise
D) Gemini Enterprise replaced Gemini LLMs as the current name

*Answer: B.* The in-scope list distinguishes the low-code platform
layer from the underlying model layer it configures via system
instructions and prompting — they are related but distinct scope
items. (A) collapses a real distinction. (C) is false — Gemini
Enterprise agents are still ultimately powered by Gemini LLMs under the
hood. (D) fabricates a rename that isn't in the currency-corrections
table.

**Q13.** An HR agent built in CX Agent Studio needs to reference a
value the user provided two pages earlier (their employee ID) on the
current page, without asking for it again. What makes this possible?
A) A brand-new system instruction on every page repeating the ID
B) Parameters collected earlier in the flow persist and remain
   available for reference (e.g., in transition-route conditions or
   response text) on later pages within the flow
C) This is not possible in CX Agent Studio; only ADK agents can carry
   state across pages
D) Only Agent Search can carry values between pages

*Answer: B.* Collected parameters are part of the flow's state and
stay available to later pages, which is exactly what enables
multi-page forms without re-asking for prior answers. (A) is
unnecessary and not how parameter persistence works. (C) is false —
this is a native CX Agent Studio capability, not something requiring
custom code. (D) is a data-grounding mechanism, unrelated to in-flow
parameter state.

**Q14.** A team wants a Gemini Enterprise agent to ground answers on
both a structured product-pricing dataset and a set of unstructured
onboarding-guide PDFs, and asks whether Agent Search can handle both.
What is the correct answer, per task 1.2?
A) No — Agent Search only supports one data shape (structured OR
   unstructured), never both together
B) Yes — task 1.2 covers connecting proprietary data sources generally
   as well as ingesting/processing unstructured multimodal data, and
   nothing restricts an agent to a single data shape
C) No — structured data requires a custom ADK agent with RAG Engine
D) Yes, but only if both sources are stored in the same Cloud Storage
   bucket

*Answer: B.* Task 1.2's two bullets (secure connection/query of
proprietary sources generally, plus unstructured multimodal ingestion)
are complementary, not mutually exclusive — a Gemini Enterprise agent
can be grounded on a mix of data shapes. (A) invents a restriction not
in the guide. (C) unnecessarily escalates to custom code for something
Section 1's own low-code tooling covers. (D) is a fabricated storage
constraint.

**Q15.** True or False: because CX Agent Studio and Agent Designer are
both "low-code," they always produce functionally identical agents for
any given requirement, and the choice between them is purely stylistic.
A) True — the choice never affects functional capability
B) False — the two tools embody different design paradigms (free-form
   instruction-driven configuration versus explicit state-machine
   structure), so the right choice depends on whether the use case
   needs that structural state machine
C) True, because both ultimately call the same Gemini LLMs
D) False, but only because CX Agent Studio is strictly a superset of
   Agent Designer's capabilities

*Answer: B.* This is the recurring Section 1 theme: matching tool to
task. A use case genuinely needing pages/transition routes/event
handlers is better served by CX Agent Studio; one that doesn't is
better served by Agent Designer's simpler model — the choice is
functional/appropriateness-driven, not merely stylistic. (A) and (C)
both ignore the real structural difference (that both eventually call
Gemini LLMs doesn't make the authoring paradigms interchangeable). (D)
is an unsupported superset claim.
