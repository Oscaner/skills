// scripts/emit/issue-templates.mjs — .github/ISSUE_TEMPLATE emitter.
//
// Renders the three GitHub issue template forms (bug_report / enhancement /
// session_report) from the canonical `finding-meta.json` via the report-issue
// renderer single point (report-templates.renderYml). Data-driven convention:
// form field definitions live solely in the canonical JSON — nothing hardcoded
// here. Round-trip ①: the first render must reproduce the committed yml
// byte-for-byte (drift-checked by the emit diff).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { renderYml } from "../../packages/osuperpowers/scripts/report-templates.mjs";

const META_PATH = fileURLToPath(
  new URL(
    "../../packages/osuperpowers/skills/report-issue/templates/finding-meta.json",
    import.meta.url,
  ),
);

// 表单名 = canonical formFieldDefs 对象键（单源；无第二处字面量列表）。
/**
 * Emit `.github/ISSUE_TEMPLATE/*.yml` into `outRoot`.
 * @param {string} outRoot absolute output root (repo root in write mode, temp tree in check mode)
 * @param {unknown} _source unused — forms come from the canonical finding-meta.json
 * @param {{ generatedPaths: string[] }} opts repo-relative paths produced by this emitter
 */
export function emitIssueTemplates(outRoot, _source, { generatedPaths }) {
  const meta = JSON.parse(readFileSync(META_PATH, "utf8"));
  for (const name of Object.keys(meta.formFieldDefs)) {
    const rel = `.github/ISSUE_TEMPLATE/${name}.yml`;
    const file = join(outRoot, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderYml(meta.formFieldDefs[name]));
    generatedPaths.push(rel);
  }
}