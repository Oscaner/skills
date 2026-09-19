# Template Doctrine

Maintainer-only doctrine for systematizing both template planes in this repository: the **engine prompt templates** (prompt products the dispatch builds) and the **skill document templates** (artifact/methodology templates the skills ship). Both had the same disease — scattered prose, no normalized structure — and both converge on the same data-driven treatment.

## The two planes

| Plane | Files | Product |
|---|---|---|
| Engine prompt templates | `packages/cdd-engine/templates/` — `engine-config.json` + `template-contract.json` + `schema/` (`task-handoff-schema.json` · `docs-handoff-schema.json` · `cache-profile-schema.json`) | prompts injected into dispatches |
| Skill document templates | `packages/osuperpowers/skills/*/docs/` — `phase-spec-template.md` · `overall-spec-template.md` · `add-phase-protocol.md` · `base-branch.md` | artifact scaffolds + methodology the skills ship |

## The five-layer convergence (P4 layers → P6 fifth layer)

P4 converged four layers of the prompt templates; P6 adds the fifth:

1. **JSON structure** — agent-facing JSON structures are the JSON Schema, verbatim (`JSON.stringify(schema)` injection, zero hand-written "simplified" renders)
2. **Document structure** — one fixed skeleton (`## Instructions` / `## Handoff` / `## Return` / `## Round context`, `skeleton.sections`)
3. **Naming** — scoped prefixes (`task-*` / `docs-*`), family-aligned directories
4. **Description** — schemas carry descriptions; writing-protocol rules live in the schema, not duplicated prose
5. **Structural skeleton + clause library + injection contract** (P6) —
   - **Skeleton registry** (`template-contract.json#skeleton`): one declarative section list (`sections: [Instructions, Handoff, Return, Round context]`) plus zone segment map **`segments: {shell, return, round-context}`** and render `order: [shell, return, round-context]` — the cache-zone split is a skeleton attribute, not a one-off reorder
   - **Clause library** (`template-contract.json#clauses`): every discipline clause (English comments, EOF newline, no full-tree `find`, stall-termination, plan/spec freeze, atomic commit, self-validate) lives once as byte-single-source text, referenced via `{{> cl:…}}` partial refs — changing a rule updates every template on one line
   - **Token registry** (`template-contract.json#tokens`): the 19 distinct injection tokens (17 `round-context` + 2 `return` — verified mechanically) become data (name / zone); the renderer drives off the registry; template text carries no loose tokens

## Single-plane-single-file (data consolidation)

Group data by consumer plane — one file per plane, one load point, one version unit:

- `engine-config.json` — runtime config plane: `context-contract` + `failure-categories` + `handoff-namespace`, sections within one file
- `template-contract.json` — render-data plane: skeleton (incl. `segments`) + tokens + clauses + `reviews.json` (its only consumer is the renderer)
- `schemas` stay standalone — dual-use surfaces (JSON-Schema validators load them directly; they are injected verbatim as their own byte unit) must not be embedded

Guards against the reverse debt (one mega-file): group by consumer plane · never merge dual-use surfaces · an injection byte-unit is a cache version-unit (touching the contract file re-versions the render data; the schema injection bytes stay untouched).

## Cache integration

The segment attribute (C1) is the cache contract's landing spot: the shell (`## Instructions` + `## Handoff`, slot-free) plus the frozen per-format `## Return` constant are the cached prefix fuel; `## Round context` is the single dynamic zone — the only place per-dispatch token moustaches render. `validateTemplateStructure` takes the skeleton as input and asserts no token lands outside its owning zone.

## Experience baking

Skill document templates additionally bake in the P1→P6 experience asset (see `program-experience.md`, condensed in the P6 spec §2.6): four-table sync mechanics, clean-tree prerequisite, session-call semantics, backfill-as-version, no-claim-without-enforcement, anti-residue guards, capability claims. A template is a convergent scaffold, not a bare skeleton — it carries the decisions that took a program to learn them.

## Interaction with emit

Skill doc templates are emit-included: a template edit is picked up by the emit chain (`scripts/run.ts emit`), and `emit:check` pins any drift — no manual editing of derived products.
