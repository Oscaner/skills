// scripts/emit/render-yaml.mjs — issue-form YAML rendering, emit-only module.
//
// The handwritten emitScalar / isPlainUnsafe YAML builder was replaced by the `yaml`
// package, and this renderer is isolated to an emit-only module — `yaml` lives only in the
// repo root devDependencies (emit toolchain), never in a shipped package's dependencies.
// The consumer runtime (the `cdd issue render` renderer in cdd-engine) imports zero
// third-party packages. The only consumers are `scripts/emit/*.mjs` (the issue-templates
// emitter) and the colocated vitest suite (scripts/emit/__tests__).
import { stringify } from "yaml";

// Form keys = formFieldDefs object keys (issue-body.json); frontmatter.name carries the
// form name, rendering consumes only formDef — no secondary identifier. Enum direct-reference
// (single-source): the only dropdown is component,
// whose options are injected directly by the second arg `enums.components` (the top level
// of canonical issue-body.json already has this shape) — zero `options` arrays inside the
// form definition, so no "two implementations to keep in sync" surface; no fallback branch
// (enum injection already converged to direct reference).
export function renderYml(formDef, enums = {}) {
  const { frontmatter, body } = formDef;
  const doc = {
    name: frontmatter.name,
    description: frontmatter.description,
    labels: frontmatter.labels,
    body: body.map((item) => {
      const entry = { type: item.type };
      if (item.id) entry.id = item.id;
      const attributes = { ...item.attributes };
      if (item.type === "dropdown" && item.id === "component") {
        attributes.options = enums.components;
      }
      entry.attributes = attributes;
      if (item.validations?.required !== undefined) {
        entry.validations = { required: item.validations.required };
      }
      return entry;
    }),
  };
  // lineWidth: 0 = no wrapping (the old emitScalar did not wrap either); default indent 2.
  // EOF newline comes in the stringify output (round-trip contract: emit:check freshness
  // guard).
  return stringify(doc, { indent: 2, lineWidth: 0 });
}
