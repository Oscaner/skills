# Template Doctrine

Maintainer-only doctrine for systematizing both template planes in this repository: the **engine prompt templates** (prompt products the dispatch builds) and the **skill document templates** (artifact/methodology templates the skills ship). Both had the same disease — scattered prose, no normalized structure — and both converge on the same data-driven treatment.

## The two planes

| Plane | Files | Product |
|---|---|---|
| Engine prompt templates | `packages/cdd-engine/templates/` — 4 `.md` + `engine-config.json` + `template-contract.json` + 2 schemas | prompts injected into dispatches |
| Skill document templates | `packages/osuperpowers/skills/*/docs/` — `phase-spec-template.md` · `overall-spec-template.md` · `add-phase-protocol.md` · `base-branch.md` | artifact scaffolds + methodology the skills ship |

## The five-layer convergence (P4 layers → P6 fifth layer)

P4 converged four layers of the prompt templates; P6 adds the fifth:

1. **JSON structure** — agent-facing JSON structures are the JSON Schema, verbatim (`JSON.stringify(schema)` injection, zero hand-written "simplified" renders)
2. **Document structure** — one fixed skeleton (`# Title` / `## Instructions` / `## Handoff` / `## Return`)
3. **Naming** — scoped prefixes (`task-*` / `docs-*`), family-aligned directories
4. **Description** — schemas carry descriptions; writing-protocol rules live in the schema, not duplicated prose
5. **Structural skeleton + clause library + injection contract** (P6) —
   - **Skeleton registry** (`template-contract.json#sections`): one declarative section list (id / heading / subsection / clause references / injection points) plus **`segments: {static, variant}`** — the cache two-zone is a skeleton attribute, not a one-off reorder
   - **Clause library** (`template-contract.json#clauses`): every discipline clause (English comments, EOF newline, no full-tree `find`, stall-termination, plan/spec freeze, atomic commit, self-validate) lives once as byte-single-source text, referenced via `{{> clause cl:...}}` — changing a rule updates every template on one line
   - **Token registry** (`template-contract.json#tokens`): the 18 distinct injection tokens (verified 2026-09-18) become data (id / semantic / owning section / static-variant tag); the renderer drives off the registry; template text carries no loose tokens

## Single-plane-single-file (data consolidation)

Group data by consumer plane — one file per plane, one load point, one version unit:

- `engine-config.json` — runtime config plane: `context-contract` + `failure-categories` + `handoff-namespace`, sections within one file
- `template-contract.json` — render-data plane: skeleton (incl. `segments`) + tokens + clauses + `reviews.json` (its only consumer is the renderer)
- `schemas` stay standalone — dual-use surfaces (JSON-Schema validators load them directly; they are injected verbatim as their own byte unit) must not be embedded

Guards against the reverse debt (one mega-file): group by consumer plane · never merge dual-use surfaces · an injection byte-unit is a cache version-unit (touching the contract file re-versions the render data; the schema injection bytes stay untouched).

## Cache integration

The two-zone segment attribute (C1) is the cache contract's landing spot: static sections (Title + Instructions + Handoff shell + schema injection) are the cached prefix fuel; variant sections (H1/task/round/gate-target) are the tail. Byte-invariance tests take the skeleton as input and assert no variant token lands in a static segment.

## Experience baking

Skill document templates additionally bake in the P1→P6 experience asset (see `program-experience.md`, condensed in the P6 spec §2.6): four-table sync mechanics, clean-tree prerequisite, session-call semantics, backfill-as-version, no-claim-without-enforcement, anti-residue guards, capability claims. A template is a convergent scaffold, not a bare skeleton — it carries the decisions that took a program to learn them.

## Interaction with emit

Skill doc templates are emit-included. Batch template rewrites with the `.agents/` emit-surface removal so the rewrite lands once, post-removal, without an emit round-trip.