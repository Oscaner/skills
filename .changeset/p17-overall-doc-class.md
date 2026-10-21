---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/kairos": minor
---

P17: the `overall-spec` doc type retires and the charter's class name becomes `overall` — a **major breaking** change with **zero dual-read**. The new value lands once in `DOC_TYPE_VALUES` and every derived surface follows it: the `doc-type:` front-matter value, the declaration registry key, the `cdd schema get overall` key, and the pipeline's doc-key branches. Overalls also move to a third doc root, `docs/kairos/overalls/` (alongside `docs/kairos/specs/` and `docs/kairos/plans/`). Migrating a consumer is two edits: change the document's `doc-type: overall-spec` to `doc-type: overall`, and move the file from `docs/kairos/specs/` to `docs/kairos/overalls/` — the engine reads no legacy spelling and no legacy path. The kairos skills and the README family follow the same spelling and doc-root move.

The review read face gains `INPUT_OVERALL`: a face whose spec carries a `program:` now carries the parent charter, and the spec axis judges **program conformance** — the phase must sit inside the scope the overall's Phase inventory registered for it, and a phase that reaches beyond it is a completeness finding. Template contract `$version` 15.

A document declaring the retired `doc-type: overall-spec` now reports the accurate failure — the value sits outside the declared domain and the wording names the allowed domain — instead of the previous false "missing `doc-type:` key" finding.

The handoff carrier is one op-derived plane instead of the face-bisected pair: `implement` / `fix` write the `work` plane (`status` · `artifacts` · `notes`) and `review` writes the `judge` plane (`findings` · `artifacts` · `notes`), so the `delivery` / `findings` carrier split and `HandoffFamily.schema` are gone. A docs-fix round now reports `status` like every other work round — the residual-findings encoding and the dead `failure_category` field are removed — and the template contract moves to `$version` 16. The wave gate also gains a static-batch guard: dispatching a `--tasks` set that hits a derived `DependsOn` batch mixing closed and open tasks returns a `mixed-batch` BLOCK (a batch closes as a unit) instead of letting the leftover tasks ride out as their own wave.
