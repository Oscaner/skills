---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/kairos": patch
---

P8 T7 — consumer-surface sync + pin re-anchor (seven-command face · `deriveDocType` retirement):

- **README ×4 sync** — the cdd-engine README (+ zh-CN mirror) `## CLI` table gains the
  `board` row; the kairos README (+ zh-CN mirror) command list gains `board` in
  `CDD_SUBCOMMANDS` member order. `presentation-surface.test.ts`'s `CDD_SUBCOMMANDS` widens
  to the seven values.
- **Consumer pins re-anchor** — the `plan-graph` retirement pins in
  `face/__tests__/cli.test.ts` / `projection.test.ts` re-anchor to `board` (a command word
  is not a schema type; `schema get board` exits 2 with the derived vocabulary). Zero
  `plan-graph` literal remains anywhere in the engine or its tests.
- **D34 — filename→doc-type derivation retired** (breaking) — `Contract.deriveDocType` (the
  `-overall.md` / `-single-spec.md` suffix table) is deleted; the doc type is now the declared
  `- **Doc type**:` header fact read through the one declaration reading face
  (`BoardView.readDocType`, shared with the board and the capsule's doc-class discrimination).
  The pre-flight doc-contract gate reads that declaration: a PRESENT doc carrying no
  declaration BLOCKs over `CDD_BLOCKED` (zero filename-suffix fallback, zero dual-read layer).
  Both the spec AND the plan dispatch faces key by the declaration (`cli.ts` `#runWork` reads
  `BoardView.readDocType` for both — zero command-type carve-out, so a declaration-less plan
  hits the same null→BLOCKED seam). The obsolete `deriveDocType` describe block is removed and
  replaced by a missing-declaration BLOCKED pin (seam + plan-face).
