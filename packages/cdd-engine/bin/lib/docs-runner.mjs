// packages/cdd-engine/bin/lib/docs-runner.mjs — lightweight runner for docs-task.mjs.
// No commit-contract, no ledger, no probeSkills.
// Spawns doc agent CLI; validates handoff against docs-handoff-schema.json.
// Bug L fix: subprocess cwd = gitToplevel(process.cwd()), not workspace/doc directory.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invokeCli, resolveTimeoutMs } from "./cli-shared.mjs";
import { gitToplevel, writeHandoff } from "./contract.mjs";
import { loadRegistry, checkHarness } from "./registry.mjs";
import { validateHandoffSchema } from "./schema-utils.mjs";
import { PKG_ROOT, renderHandoffStub, renderTemplate } from "./templates.mjs";

const DOCS_SCHEMA_PATH = path.join(PKG_ROOT, "templates", "schema", "docs-handoff-schema.json");
const REG_PATH = fileURLToPath(new URL("../harness-registry.json", import.meta.url));

export async function runDocsTask({
  harness,
  mode,
  template,
  doc,           // path to the document being reviewed/fixed
  findingsPath,
  handoffPath,
  workspace,
  round = 1,
  dryRun = false,
  params = {},   // additional template params from --param KEY=VALUE flags
  // repoRoot accepted in opts but ignored — gitToplevel(process.cwd()) is always used (Bug L fix)
}) {
  if (dryRun) {
    return { exitCode: 0, handoff: { phase: mode, status: "APPROVED", findings: [], artifacts: {}, doc_path: doc } };
  }

  // Bug L fix: use gitToplevel(process.cwd()) as subprocess cwd, not workspace (doc directory).
  const repoRoot = gitToplevel(process.cwd());
  if (!repoRoot) throw new Error("docs-runner: not in a git repo");

  // Derive handoffPath from workspace + template + round if not provided explicitly.
  const resolvedHandoffPath = handoffPath ?? path.join(workspace, `${template}-${round}.json`);

  // Render prompt from template (two-pass: first renderTemplate for {{DOC}}/{{FINDINGS}}/{{HANDOFF}},
  // then replace {{HANDOFF_STUB}} with schema-derived stub).
  const schema = JSON.parse(readFileSync(DOCS_SCHEMA_PATH, "utf8"));
  const stub = renderHandoffStub(schema, mode, undefined, { docPath: doc });
  const templateName = mode === "fix"
    ? template.replace(/-review$/, "") + "-fix"
    : template;
  let prompt = renderTemplate(templateName, {
    DOC: doc, FINDINGS: findingsPath ?? "", HANDOFF: resolvedHandoffPath,
    ...params,
  }, "docs-runner");
  prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);

  // Spawn agent using harness registry (provides -p, --output-format, etc.).
  // cwd = repoRoot (Bug L fix: was path.dirname(handoffPath) / workspace before).
  const reg = loadRegistry(REG_PATH);
  const entry = checkHarness(reg, harness);
  const env = {};
  const timeoutMs = resolveTimeoutMs(process.env, "review");
  const res = await invokeCli(entry, prompt, mode, env, repoRoot, timeoutMs);

  // Read handoff from disk (agent writes it).
  if (!existsSync(resolvedHandoffPath)) {
    writeHandoff(resolvedHandoffPath, {
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      doc_path: doc,
      blocker: `${path.basename(resolvedHandoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${resolvedHandoffPath} before exit`,
    });
    return { exitCode: 1, handoff: JSON.parse(readFileSync(resolvedHandoffPath, "utf8")) };
  }

  const handoff = JSON.parse(readFileSync(resolvedHandoffPath, "utf8"));
  const sv = validateHandoffSchema(handoff);
  if (!sv.valid) {
    writeHandoff(resolvedHandoffPath, {
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      doc_path: doc,
      blocker: `docs handoff schema invalid: ${sv.reason} → fix the handoff JSON at ${resolvedHandoffPath} and re-run ${mode}`,
    });
    return { exitCode: 1, handoff: JSON.parse(readFileSync(resolvedHandoffPath, "utf8")) };
  }

  return { exitCode: res.code, handoff };
}
