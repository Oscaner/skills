// render-yaml.mjs — issue-form YAML rendering, emit-only module.
//
// Task 14 (§2.13 ruling (b)): the handwritten emitScalar / isPlainUnsafe YAML
// builder is replaced by the `yaml` package, and this renderer is isolated to
// an emit-only module — `yaml` lives only in the repo root devDependencies
// (emit toolchain), never in osuperpowers `package.json#dependencies`. The
// consumer runtime entry (report-templates.mjs) does not import this module.
// The only consumers are `scripts/emit/*.mjs` (issue-templates emitter).
import { stringify } from "yaml";

// Form keys = formFieldDefs object keys (finding-meta.json); frontmatter.name carries the
// form name, rendering consumes only formDef — no secondary identifier (the name param is
// de-duplicated). Enum direct-reference (single-source §2.6.1):
// the only dropdown is component, whose options are injected directly by the second arg
// `enums.components` (the top level of canonical finding-meta.json already has this shape) —
// zero `options` arrays inside the form definition, so no "two implementations to keep in
// sync" surface; no fallback branch (enum injection already converged to direct reference,
// Task 14).
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
