# _scripts/

Tooling for scaffolding and bulk-populating exam folders in this repo.

| File | Purpose |
|---|---|
| `new-exam.sh` | Creates a new isolated exam folder from `_TEMPLATE/` |
| `gen-sidebar.js` | Regenerates the root `_sidebar.md` for the GitHub Pages site — run it (`node _scripts/gen-sidebar.js`) after adding/removing files in any exam folder |
| This README | How to go from an empty scaffold to a fully-written exam folder using an AI agent, without re-explaining the process each time — and how to publish the whole repo as a browsable site |

---

## The two-step workflow

### Step 1 — scaffold the folder (you do this, once, per exam)

```bash
./_scripts/new-exam.sh AWS AWSSAA "AWS Certified Solutions Architect – Associate" SAA-C03
```

This creates `AWS/AWSSAA/` from `_TEMPLATE/`, with `CLAUDE.md` /
`GEMINI.md` / `AGENTS.md` / `llms.txt` / `README.md` already in place —
including, since 2026-08, `CLAUDE.md`'s **§12 bulk content-generation
playbook**, copied in automatically. You don't write that playbook
per exam; it already travels with every new folder.

Then fill in the exam-specific facts the script can't know on its own —
`AWS/AWSSAA/CLAUDE.md` sections 2, 3, 6, 7, 8 (who the user is, how they
want to be taught, exam format, domain weights, currency corrections,
vocabulary). This is the only manual writing step. Re-copy the file over
`GEMINI.md` and `AGENTS.md` afterward so all three stay identical (or
just ask the agent to do that in step 2 — see the kickoff prompt below).

### Step 2 — generate the content (an agent does this, in a fresh conversation)

Open a **new conversation**, scoped to the new exam folder, and give it
this prompt (or your own version of it — the point is it doesn't need
to contain any exam content, source material, or process explanation,
because all of that already lives in the folder from Step 1):

> This is exam folder `AWS/AWSSAA/`. Read its `CLAUDE.md` in full,
> including §12 (bulk content-generation playbook). Then:
> 1. Discover this exam's actual structure — read the vendor's real,
>    current exam guide and write `00-START-HERE/RUNBOOK.md` per §12
>    Step 0: the real domain/task/sub-skill hierarchy (however many
>    domains it actually has — don't assume it matches any other exam
>    folder in this repo), a coverage map, and the currency-corrections
>    findings (services added/removed from scope since the guide's
>    original version, tools renamed or deprecated).
> 2. Fold the runbook's currency findings into `CLAUDE.md` §7.
> 3. Run the §12 playbook to fill every placeholder file in this folder
>    to full depth, batching parallel background agents as it describes.
> 4. When done, update `CLAUDE.md` §5 and the runbook's own §5 checklist
>    with a per-folder summary of what got written, and propagate the
>    §5/§7 updates to `GEMINI.md` and `AGENTS.md` so all three stay
>    identical.

That's the whole prompt. No pasted source material, no restating of
"how I want to be taught," no re-explaining what a comparison matrix
should look like — the agent gets all of that from the folder's own
`CLAUDE.md`, exactly like a human contributor would.

---

## What actually happens during Step 2

This is documented in detail in `_TEMPLATE/CLAUDE.md` §12 (so it ships
with every new exam folder), summarized here:

```
 discover this exam's real       ← NOT assumed from another exam
 structure (§12 Step 0)             folder. Read the vendor's actual
        |                           guide: how many domains, what
        |                           they're called, how deep the
        |                           task/sub-skill hierarchy goes.
        v
 00-START-HERE/RUNBOOK.md    ────► the concrete output of that step:
        ^                           source URL + version, the full
        |                           hierarchy verbatim, a coverage map
        |                           (which file answers which guide
        |                           leaf), and the currency-corrections
        |                           table. Every step below reads THIS
        |                           file, not the guide again.
        |
 CLAUDE.md §7 (currency)     ←──── populated FROM the runbook's
        ^                           currency section, not derived
        |                           independently
        |
 CLAUDE.md §12 playbook  ────────► batches placeholders into groups of
        |                           4-8 files by folder/topic (sized to
        |                           THIS exam's discovered domain
        |                           count, not a fixed number), launches
        |                           one background agent per batch, in
        |                           parallel
        v
 N parallel agents  ─────────────► each agent reads CLAUDE.md AND the
        |                           runbook, writes its batch against
        |                           the runbook's coverage map,
        |                           self-verifies (no placeholder
        |                           markers left, no stale terminology,
        |                           Q&A numbering matches its own
        |                           answer key)
        v
 completion notifications  ──────► if any batch fails mid-stream (this
        |                           happens — transient infra issues,
        |                           not a content problem), check which
        |                           files in that batch actually finished
        |                           before relaunching, and relaunch a
        |                           small cleanup agent for only what's
        |                           still missing — never restart a whole
        |                           batch from scratch
        v
 final sweep  ────────────────────► one pass confirming zero files remain
                                     under ~20 lines (the placeholder size)
                                     and every leaf in the runbook's
                                     coverage map has content, then
                                     CLAUDE.md §5 and the runbook's own
                                     §5 checklist get updated
```

**Every arrow above matters for a reason learned the hard way on the
first exam folder in this repo (AWS DEA-C01):**

- The currency-check arrow exists because source material pasted into a
  chat — even material that looks thorough — can predate the vendor's
  most recent exam-guide revision. AWS revised DEA-C01 in December 2025;
  content generated without checking that first would have taught a
  deprecated tool (the standalone AWS Schema Conversion Tool) as if it
  were still a live exam answer.
- The "batch by folder, not by file" arrow exists because one-agent-per-file
  is too slow at ~90 files, and one giant agent for the whole exam
  makes a mid-run failure expensive to recover from.
- The "relaunch only what's missing" arrow exists because several
  parallel background agents can fail from the same transient
  infrastructure blip at once — restarting all of them from scratch
  would have redone a lot of already-good work for no reason.

## Publishing to GitHub Pages

The whole repo is set up to serve directly as a [Docsify](https://docsify.js.org/)
site — zero build step, renders every markdown file client-side, with
full-text search across all exams. The site files (`index.html`,
`_sidebar.md`, `.nojekyll`) already live at the repo root. **Two manual
steps only you can do** (neither is possible via git/API access):

1. **Make the repo public.** GitHub Pages requires a public repo on
   free personal plans — private-repo Pages needs GitHub Pro/Team/
   Enterprise. Settings → General → Danger Zone → Change visibility.
2. **Enable Pages.** Settings → Pages → Source: "Deploy from a branch"
   → pick the branch this content lives on (either `main` after
   merging, or point Pages directly at your working branch — both are
   valid, the working branch is faster if you don't want to merge yet)
   → folder: `/ (root)`.

Once both are done, the site is live at
`https://<username>.github.io/CertificationPrep/` (or
`https://<username>.github.io/CertificationPrep/tree-branch-name` —
GitHub always serves from the repo root regardless of which branch you
pointed Pages at, so the URL is the same either way). No further steps —
it's fully static, no GitHub Actions workflow required.

**After adding new exam content:** run `node _scripts/gen-sidebar.js`
to regenerate `_sidebar.md` before committing, so new files actually
show up in the site nav. This isn't automatic — there's no CI step
watching for it (deliberately: this repo has no build pipeline to keep
maintenance minimal).

**Isolation still holds:** these are tooling files, not exam content —
same category as `_scripts/` and `_TEMPLATE/` already at the repo
root. No exam folder's own files were touched to make this work.

## When *not* to use this

This playbook is for the explicit "generate everything now" case. The
repo's default behavior — and what a fresh exam folder should do
without being asked to bulk-generate — is **just-in-time**: fill one
placeholder at a time, on the day the study plan reaches it, per
`CLAUDE.md` rule 4. Don't kick off Step 2 above unless the user actually
wants the whole folder written in one pass; for normal day-by-day study,
just ask for the day's files directly and let the agent write only
those.
