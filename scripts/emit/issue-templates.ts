// scripts/emit/issue-templates.ts — .github/ISSUE_TEMPLATE emitter. The IssueTemplatesEmitter
// domain service (Task 9, Criterion ②: stateless, zero bare-function module).
//
// Renders the two GitHub issue template forms (bug_report / enhancement) from
// the canonical issue template JSON — the finding-meta authority now lives at
// packages/cdd-engine/templates/report/issue-body.json (the repo → engine
// one-way dependency iron rule: repo governance reads the engine's canonical,
// shipped packages never depend on repo scripts) — via the emit-only YAML
// renderer (render-yaml.renderYml in scripts/emit/: `yaml` lives only in this
// emit toolchain, never in any shipped package's dependencies). Data-driven
// convention: form field definitions live solely in the canonical JSON —
// nothing hardcoded here. Emitter output is drift-guarded by `emit:check`
// (committed yml are products of this emitter + the canonical).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderYml } from "./render-yaml.ts";

const META_PATH = fileURLToPath(
  new URL("../../packages/cdd-engine/templates/report/issue-body.json", import.meta.url),
);

// 表单名 = canonical formFieldDefs 对象键（单源；无第二处字面量列表）。
export class IssueTemplatesEmitter {
  /**
   * Emit `.github/ISSUE_TEMPLATE/*.yml` into `outRoot`.
   * @param {string} outRoot absolute output root (repo root in write mode, temp tree in check mode)
   * @param {unknown} _source unused — forms come from the canonical engine issue-body.json
   * @param {{ generatedPaths: string[] }} opts repo-relative paths produced by this emitter
   */
  emit(outRoot, _source, { generatedPaths }): void {
    const meta = JSON.parse(readFileSync(META_PATH, "utf8"));
    for (const name of Object.keys(meta.formFieldDefs)) {
      const rel = `.github/ISSUE_TEMPLATE/${name}.yml`;
      const file = join(outRoot, rel);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, renderYml(meta.formFieldDefs[name], meta));
      generatedPaths.push(rel);
    }
  }
}

export const issueTemplatesEmitter = new IssueTemplatesEmitter();
