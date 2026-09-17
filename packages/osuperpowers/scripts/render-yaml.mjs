// render-yaml.mjs — issue-form YAML rendering, emit-only module.
//
// Task 14 (§2.13 ruling (b)): the handwritten emitScalar / isPlainUnsafe YAML
// builder is replaced by the `yaml` package, and this renderer is isolated to
// an emit-only module — `yaml` lives only in the repo root devDependencies
// (emit toolchain), never in osuperpowers `package.json#dependencies`. The
// consumer runtime entry (report-templates.mjs) does not import this module.
// The only consumers are `scripts/emit/*.mjs` (issue-templates emitter).
import { stringify } from "yaml";

// 表单键 = formFieldDefs 对象键（finding-meta.json）；frontmatter.name 承载表单名，
// 渲染仅消费 formDef——无二次标识（name 参数已去冗余）。枚举直引（单源 §2.6.1）：
// 唯一 dropdown 是 component，其 options 由第二实参 `enums.components`（canonical
// finding-meta.json 顶层即满足该形状）直接注入——form 定义内零 `options` 数组，不
// 存在「两份实现需对齐」的同步面；无回退分支（枚举注入已收敛为直引，Task 14）。
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
  // lineWidth: 0 = 不折行（旧 emitScalar 同样不 wrap）；默认 indent 2。EOF newline
  // 在 stringify 产物中（round-trip contract：emit:check 输出新鲜度守卫）。
  return stringify(doc, { indent: 2, lineWidth: 0 });
}