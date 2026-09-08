// report-templates.mjs — report-issue rendering single point.
//
// Pure renderers over the canonical finding-meta.json; the renderers never
// hand-assemble finding paragraph structure. Finding body paragraphs
// (renderComment) and the session master body (renderMasterBody) share the
// six-field report-meta bullet block (renderMeta). CLI entrypoint
// (`--mode comment|master` + stdin JSON) is referenced by the report-issue
// SKILL.md for external harness adapters.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const findingMeta = JSON.parse(
  readFileSync(
    new URL("../skills/report-issue/templates/finding-meta.json", import.meta.url),
    "utf8",
  ),
);
const { sectionLabels, masterDef } = findingMeta;

// --- YAML scalar emission ------------------------------------------------
// Deterministic style rules reproducing the current .github/ISSUE_TEMPLATE
// sources byte-for-byte (round-trip ①):
//   1. embedded newline            -> literal block (`|`, content at 8 spaces)
//   2. ": " or em-dash "—"         -> double-quoted (colon-space must be quoted
//                                     in YAML; upstream also authored the
//                                     em-dash descriptions double-quoted)
//   3. otherwise                   -> plain scalar
function emitScalar(value) {
  if (value.includes("\n")) {
    const content = value.endsWith("\n") ? value.slice(0, -1) : value;
    return (
      "|\n" +
      content
        .split("\n")
        .map((line) => `        ${line}`)
        .join("\n")
    );
  }
  if (value.includes(": ") || value.includes("—") || isPlainUnsafe(value)) {
    // 转义顺序：先 `\` 再 `"`（先用反引号会把已插入的 `\` 双重转义）。
    return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }
  return value;
}

// YAML plain-scalar 陷阱守卫：前导特殊字符 / YAML 1.1 bool·null / 类数字或日期
// 样式串若按 plain 输出会被解析器误读 → 一律转 double-quoted（当前语料安全，守卫防御未来键值）。
function isPlainUnsafe(value) {
  return /^(?:true|false|null|yes|no|on|off|~|[-+]?(?:\d|\.\d)|\d{4}-)|^[][{}*&!|>'"%@`]|:-/.test(value);
}

function pushAttribute(lines, key, value) {
  lines.push(`      ${key}: ${emitScalar(value)}`);
}

// --- formFieldDefs -> .github/ISSUE_TEMPLATE/<name>.yml -------------------
// 表单键 = formFieldDefs 对象键（finding-meta.json）；frontmatter.name 承载表单名，
// 渲染仅消费 formDef——无二次标识（name 参数已去冗余）。
export function renderYml(formDef) {
  const { frontmatter, body } = formDef;
  const lines = [];
  lines.push(`name: ${frontmatter.name}`);
  lines.push(`description: ${emitScalar(frontmatter.description)}`);
  lines.push(
    `labels: [${frontmatter.labels.map((label) => `"${label}"`).join(", ")}]`,
  );
  lines.push("body:");
  for (const item of body) {
    lines.push(`  - type: ${item.type}`);
    if (item.id) lines.push(`    id: ${item.id}`);
    lines.push("    attributes:");
    for (const [key, value] of Object.entries(item.attributes)) {
      if (key === "options") {
        lines.push("      options:");
        for (const option of value) lines.push(`        - ${option}`);
      } else {
        pushAttribute(lines, key, value);
      }
    }
    if (item.validations?.required !== undefined) {
      lines.push("    validations:");
      lines.push(`      required: ${item.validations.required}`);
    }
  }
  return lines.join("\n") + "\n"; // EOF newline is in the round-trip contract
}

// --- master body pieces ----------------------------------------------------
export function renderTitle(masterDef, { slugOrStandalone, date }) {
  return masterDef.title
    .replace("<slug|standalone>", slugOrStandalone)
    .replace("<YYYY-MM-DD>", date);
}

/** report-meta 六字段 bullet — canonical metaFields（key+label 对）驱动，零硬编码。 */
export function renderMeta(meta) {
  return findingMeta.metaFields
    .map(({ key, label }) => `- ${label}: ${meta[key] ?? ""}`)
    .join("\n");
}

export function renderSummaryTable(findings) {
  const { cols, placeholder } = masterDef.summaryTable; // 表头/占位取自 canonical，不硬编码（R1）
  const header = `| ${cols.join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const rows = findings.map(
    (f, i) => `| ${i + 1} | ${f.type} | ${f.component} | ${f.title} |`,
  );
  return `${header}\n${sep}\n${rows.join("\n")}\n\n${placeholder}`;
}

// --- finding comment / master body ---------------------------------------
export function renderComment({ finding, lang = "en", related, meta }) {
  const labels = sectionLabels[finding.type][lang]; // context/problem/impact/suggestedFix 段落序（oracle = canonical）
  const body = [
    `${labels.context}\n\n${finding.context}`,
    `${labels.problem}\n\n${finding.problem}`,
    `${labels.impact}\n\n${finding.impact}`,
    `${labels.suggestedFix}\n\n${finding.suggestedFix}`,
  ];
  if (related) body.push(`## Related\n\n${related}`);
  body.push(`## Report meta (auto)\n${renderMeta(meta)}`);
  return body.join("\n\n");
}

export function renderMasterBody({ kind, meta, findings }) {
  // Session 元数据块 + Findings Summary 表 + 末端 `## Report meta (auto)`
  // （与 finding comment 同规，Global §report-meta）
  return [
    `## Session\n\n- Session: ${meta.session ?? "standalone"}\n- Kind: ${kind}\n- Date: ${meta.date}`,
    `## Findings Summary\n\n${renderSummaryTable(findings)}`,
    `## Report meta (auto)\n${renderMeta(meta)}`,
  ].join("\n\n");
}

// --- CLI -------------------------------------------------------------------
const isCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  const modeIndex = process.argv.indexOf("--mode");
  const mode = modeIndex === -1 ? "comment" : process.argv[modeIndex + 1];
  const input = JSON.parse(readFileSync(0, "utf8"));
  process.stdout.write((mode === "master" ? renderMasterBody(input) : renderComment(input)) + "\n");
}