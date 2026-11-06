---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/kairos": minor
---

P26 — the closeout surface's remaining debts and the doc-shape ownership criterion.

`cdd-engine` (consumer-visible):

- **Body-only doc revisions (#417).** Every `doc-revision` (plan line, spec line, branch line) now hashes the document BODY: the YAML front matter and the `## Change history` section are projected away by the contract plane's `DocBodyProjection`. A bookkeeping write (a `version:` bump, an appended change-history row) no longer reopens a reviewed line, while a substantive body edit still drifts. The doc-revision rejection message follows (`amend body to open a new review`).
- **Six diagram twins + journey semantics (#418).** `diagram-twin.guard.test.ts` twins all six diagram sources (architecture · journey · next-loop, each en + zh-CN) against their generated HTML — citation multiset, `referenceCount`, revision pin, and every label / sublabel / tag / card title / card item — and `journey-twin.test.ts` pins the journey pair's wave width, `--type` vocabulary and log path to the runtime constants. No product is written and no Archify dependency is added.
- **A closed single-spec hands off to `cdd-plan`.** `PIPELINE_NEXT["single-spec"]` is now the `kairos:cdd-plan` ref (the `overall` charter stays the only program-level terminal), so a closed standalone spec renders `next: route to <host cdd-plan> skill` with `reason: closed-line` instead of `next: done` — in the capsule and on the board.

`kairos` skill text (`@oscaner-skills/kairos`, the same phase, wave 2):

- `cdd-design`: the `mode?` question becomes an OWNERSHIP judgment (does the change fall inside a registered program's scope?), `size?` narrows to charter-or-not, and a `phase-within-program` producing a single-spec is BLOCKED.
- `cdd-close`: the `closeout-backfill` node carries its two branches explicitly (a registered phase row → Done + delivery evidence; a standalone single-spec → close only the spec's own version row, change history and issue).
