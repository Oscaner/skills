---
"@oscaner-skills/cdd-engine": minor
---

**The `status` front-matter field is retired from the document contract.** It declared three times (`overall` · `phase-spec` · `single-spec`) and no rule ever read it, yet every writing agent had to keep it in sync by hand — and 21 of the repo's 22 documents sat at `Draft` for their whole life, the single `Approved` being a hand-written literal. The three registry elements are gone, so the field is no longer required, no longer domain-checked, and no longer emitted by the skeleton: `cdd schema get <type> --output skeleton` now produces a head of `title` · `doc-type` · `version` · `date` · `slug` · the type's own keys · `author`, and every rendered skeleton still passes its own contract judgment.

No gate replaces it. A document that still carries a `status:` key parses and judges exactly as before — the stray head key is a residue of a retired field, not a violation, and a "no residual `status`" rule would be a new machine paying for an old field. Code that reads a document head keeps answering `status` when the key is present (the board's doc line still renders it), so existing documents degrade to a shorter line rather than to an error.

The corpus shipped with this package's own repository drops the line from all 22 documents (`docs/kairos/overalls/**` · `docs/kairos/specs/**`), with the corresponding skeleton, registry, projection-snapshot and CLI pins reanchored.
