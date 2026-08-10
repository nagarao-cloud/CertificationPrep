# Terraform Versions of the Labs

> **Cut this first if you're behind schedule.** Per the 10-Day Plan's
> "If you fall behind" list, Terraform labs are cost item #1 to drop —
> "zero exam value." That's not a throwaway line; it's the honest
> reason this file is short and the snippets below are illustrative,
> not copy-paste-runnable modules.

---

## Why this folder is console-first, not Terraform-first

Every lab in `05-labs/` is written console-first, with a CLI
equivalent shown alongside each step, and Terraform is deliberately
**not** the primary path. Three reasons, in order of importance for a
beginner on a 10-day timeline:

1. **DEA-C01 does not test infrastructure-as-code syntax.** It tests
   whether you know that a Glue crawler infers a schema, that a job
   bookmark tracks processed state, that Lake Formation grants can be
   column-level. None of that knowledge is denser or clearer in HCL —
   if anything, Terraform *hides* it. A `aws_glue_crawler` resource
   block with twelve arguments doesn't teach you why the crawler needs
   to be pointed at the partition root instead of a `month=01/`
   subfolder (LAB-01's Common Error #1); watching it fail in the
   console and reading the error does.
2. **Terraform adds a second failure surface for a beginner to
   debug.** When something breaks in the console, you're debugging one
   thing: the AWS resource. When something breaks in Terraform, you're
   debugging two things: the AWS resource *and* whether your HCL
   actually expresses the intent you think it does (provider version
   drift, implicit dependency ordering, state file confusion). That
   second failure surface is real engineering skill — just not the
   skill this 10-day sprint is optimizing for.
3. **The console makes AWS's own mental model visible.** Every wizard
   screen this repo's labs walk through (Glue crawler creation,
   Firehose dynamic partitioning config, Lake Formation's grant UI) is
   AWS's own opinionated breakdown of "here are the decisions that
   matter for this resource." Skipping straight to a Terraform module
   skips past that breakdown into someone else's already-made
   decisions.

None of this means Terraform is bad — it's the right tool for running
these labs repeatably, tearing them down cleanly, or standing up a
whole lab environment for a study group in one `apply`. That's exactly
why the patterns below exist: as a reference for *later*, once the
console-first pass has done its job, or for anyone who's already
comfortable with Terraform and wants a repeatable version of what
they just clicked through.

---

## What's here (and what isn't)

This file has **illustrative snippets** for three labs — enough to see
the shape of the pattern and map it back to the console steps you
already did. It is **not**:

- A complete, `terraform apply`-ready module for every lab
- Tested against a specific provider version (pin `hashicorp/aws` to
  whatever is current when/if you actually use these)
- A replacement for reading the lab's own step-by-step instructions —
  every snippet below assumes you've already read the corresponding
  lab in full

If you want working Terraform for real, treat each snippet as a
starting skeleton: fill in variables, add the IAM roles/policies the
lab's Console steps created for you automatically (Terraform won't
create those implicitly — this is itself a useful thing to notice:
console wizards do a surprising amount of invisible IAM plumbing),
and run `terraform plan` before ever running `apply`.

---

## LAB-01 (S3 + Glue Crawler) — illustrative

```hcl
resource "aws_s3_bucket" "lab01" {
  bucket = "dea-lab01-${var.initials}-${var.suffix}"
}

resource "aws_s3_bucket_public_access_block" "lab01" {
  bucket                  = aws_s3_bucket.lab01.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_glue_catalog_database" "lab01" {
  name = "dea_lab_db"
}

resource "aws_glue_crawler" "orders" {
  name          = "dea-lab01-orders-crawler"
  role          = aws_iam_role.glue_crawler.arn
  database_name = aws_glue_catalog_database.lab01.name

  s3_target {
    # Point at the partition ROOT, not a year=/month= subfolder —
    # this is LAB-01 Common Error #1, and Terraform won't stop you
    # from making the same mistake; it just codifies whatever path
    # you give it.
    path = "s3://${aws_s3_bucket.lab01.bucket}/raw/orders/"
  }
}

# The crawler's IAM role, trust policy, and S3-access policy are all
# separate resources the console wizard created for you silently in
# LAB-01 Step 6 — in Terraform you own writing every one of them
# (aws_iam_role, aws_iam_role_policy_attachment, aws_iam_policy...).
# Omitted here for brevity — see LAB-01 Step 6's trust-policy JSON
# for what has to exist.
```

**What this buys you over the console:** re-running `terraform apply`
after `terraform destroy` gives you the exact same bucket/crawler/
database names and config, every time — useful for a study group
doing the same lab on different days, less useful for a solo learner
who benefits more from typing the console path once and feeling it.

---

## LAB-02 (Glue ETL Job with Bookmarks) — illustrative

```hcl
resource "aws_glue_job" "csv_to_parquet" {
  name     = "dea-lab02-csv-to-parquet"
  role_arn = aws_iam_role.glue_job.arn

  glue_version      = "5.0"
  worker_type       = "G.1X"
  number_of_workers = 2

  command {
    name            = "glueetl"
    script_location = "s3://${aws_s3_bucket.lab02.bucket}/scripts/job.py"
    python_version  = "3"
  }

  default_arguments = {
    # This is the setting LAB-02's entire lab hinges on — the same
    # line that's easy to forget in the console (Common Error #1)
    # is just as easy to forget or fat-finger here.
    "--job-bookmark-option"       = "job-bookmark-enable"
    "--enable-metrics"            = "true"
    "--TempDir"                   = "s3://${aws_s3_bucket.lab02.bucket}/temp/"
  }
}
```

Note what's conspicuously **absent**: the visual ETL job graph
(source → SQL transform → target) that LAB-02 Step 3 builds by
clicking. Terraform's `aws_glue_job` resource just points at a
pre-written script in S3 — you'd still have to author `job.py`
yourself (essentially what Glue Studio auto-generated for you in the
console), which is real Spark/PySpark work, not something Terraform
does or replaces.

---

## LAB-05 (Firehose Dynamic Partitioning) — illustrative

```hcl
resource "aws_kinesis_firehose_delivery_stream" "orders" {
  name        = "dea-lab05-events-stream"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose.arn
    bucket_arn = aws_s3_bucket.lab05.arn

    dynamic_partitioning_configuration {
      enabled = true
    }

    # Dynamic partitioning keys, buffer hints, and the Parquet
    # conversion / Glue-table reference are all deeper nested blocks
    # the AWS provider models faithfully but verbosely — this is the
    # single clearest example in this whole file of "the console's
    # guided wizard genuinely explains the concept better than the
    # equivalent HCL does," because the console visually separates
    # partitioning keys from buffer hints from format conversion in
    # three distinct wizard sections, while Terraform flattens all
    # three into sibling nested blocks with no such visual hierarchy.
  }
}
```

---

## Should you bother with any of this during your 10 days?

**No, unless:**
- You're already fluent in Terraform and find reading HCL faster than
  clicking through console wizards (rare for someone who self-describes
  as beginner-to-AWS-data-engineering, per this repo's stated audience
  — see the root `CLAUDE.md`).
- You're running these labs for a study group and want repeatable
  teardown/rebuild between sessions.
- You've already finished Day 9's mock exams with a comfortable score
  and are looking for genuinely optional, non-exam-relevant extra
  practice.

**Otherwise:** skip this file entirely, per the 10-Day Plan. Every
console step you did in LAB-01 through LAB-08 taught you something
Terraform would have quietly done for you instead.
