# Mind Maps

> ASCII mind maps for whole-exam and whole-domain orientation. Use
> these to check you can reconstruct the shape of each domain from
> memory before diving into `01-domains/` for depth.

## Whole-exam mind map

```
                              PCA Exam
                                 │
        ┌───────────┬───────────┼───────────┬───────────┬───────────┐
        ▼           ▼           ▼           ▼           ▼           ▼
    Domain 1     Domain 2     Domain 3     Domain 4     Domain 5     Domain 6
    Design &     Manage &     Security &   Analyze &    Managing     Reliability
    Plan (24%)   Provision    Compliance   Optimize     Implement.   (12%)
                 (15%)        (20%)        (18%)        (11%)
        │           │           │           │           │           │
   biz+tech      network      IAM/         cost/perf    advising    monitoring/
   requirements, storage,     encryption/  optimize,    dev teams,  logging,
   net/storage/  compute      compliance   process       tool         deploy/
   compute       provisioning              analysis      selection    release
   design,                                                            mgmt
   migration
   planning

              Cross-cutting: 4 Case Studies (20-30% of exam)
              EHR Healthcare | Helicopter Racing League |
              Mountkirk Games | TerramEarth
              — each recombines all 6 domains into one scenario
```

## Domain 1 mind map

```
                    Designing & Planning (24%)
                              │
        ┌───────────┬─────────┼─────────┬───────────┐
        ▼           ▼         ▼         ▼           ▼
     1.1 Biz     1.2 Tech   1.3 Net/   1.4         1.5 Future
     requirements requirements Storage/  Migration   improvements
        │           │         Compute    │           │
     translate   SLA/SLO,     design     6 R's,      judgment-
     stakeholder availability,   │       data          based,
     language,   resiliency,  region/    transfer,     re-evaluate
     licensing,  performance   zone,     sequencing,   on real
     BCP, KPIs                 topology,  cutover       inflection
                                compute/               points only
                                storage
                                selection
```

## Domain 3 mind map

```
                Security & Compliance (20%)
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
   3.1 Security design                 3.2 Legal compliance
        │                                   │
   ┌────┼────┬────────┬────────┐      ┌─────┼─────┐
   ▼    ▼    ▼        ▼        ▼      ▼     ▼     ▼
  IAM  hier- data    sep.   securing  HIPAA GDPR  audit/
       archy protect duties  AI       /PCI        Assured
                                                    Workloads
```

## Case-study recombination mind map (how one scenario tests many
domains at once)

```
                    "EHR Healthcare needs a DR plan
                     for their EU clinical system"
                              │
        ┌──────────┬──────────┼──────────┬──────────┐
        ▼           ▼          ▼          ▼          ▼
    Domain 1     Domain 3   Domain 6   Domain 4    Domain 2
    (RTO/RPO     (residency (HA/DR      (drill      (Terraform
    elicited      boundary   tier        process,    provisions
    from the      for the    implement-  cost vs.    the DR
    business)     failover   ation)      SLA         region's
                  target)                tradeoff)   resources)
```
This is why case studies are weighted so heavily — a single question
cluster tests recall and reasoning across nearly every domain
simultaneously, which no single-domain question bank can fully
replicate. Practice case studies deliberately, not as an afterthought.
