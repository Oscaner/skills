// engine/lib/docs-runner.mjs — lightweight runner for docs-task.mjs.
// No commit-contract, no ledger, no probeSkills.
// Spawns doc agent CLI; validates handoff against docs-handoff-schema.json.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnCapture } from "./cli-shared.mjs";
import { validateHandoffSchema } from "./schema-utils.mjs";
import { writeHandoff } from "./contract.mjs";
import { renderHandoffStub, renderTemplate } from "./templates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, "../../..");
const DOCS_SCHEMA_PATH = path.join(PKG_ROOT, "skills", "_templates", "docs-handoff-schema.json");

export async function runDocsTask(mode, {
  harness,
  template,      // e.g. "spec-review"
  docPath,       // path to the document being reviewed/fixed
  findingsPath,  // path to review handoff (for fix mode)
  handoffPath,   // where to write the handoff JSON
  round = 1,
  dryRun = false,
  extraParams = {},  // additional template params from --param KEY=VALUE flags
}) {
  if (dryRun) {
    return { exitCode: 0, handoff: { phase: mode, status: "APPROVED", findings: [], artifacts: {}, doc_path: docPath } };
  }

  // Render prompt from template (two-pass: first renderTemplate for {{DOC}}/{{FINDINGS}}/{{HANDOFF}},
  // then replace {{HANDOFF_STUB}} with schema-derived stub)
  const schema = JSON.parse(readFileSync(DOCS_SCHEMA_PATH, "utf8"));
  const stub = renderHandoffStub(schema, mode, undefined, { docPath });
  const templateName = mode === "fix"
    ? template.replace(/-review$/, "") + "-fix"
    : template;
  let prompt = renderTemplate(templateName, {
    DOC: docPath, FINDINGS: findingsPath ?? "", HANDOFF: handoffPath,
    ...extraParams,  // passes SPEC= and other --param KEY=VALUE pairs
  }, "docs-runner");
  prompt = prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);

  // Spawn agent (spawnCapture(command, args, opts) — opts: {cwd, env, timeoutMs}; see cli-shared.mjs)
  const { code, stdout, stderr } = await spawnCapture(harness, prompt, {});

  // Read handoff from disk (agent writes it)
  if (!existsSync(handoffPath)) {
    writeHandoff(handoffPath, {
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      doc_path: docPath,
      blocker: `${path.basename(handoffPath)} not written after exit 0 → re-run ${mode} and ensure handoff is written to ${handoffPath} before exit`,
    });
    return { exitCode: 1, handoff: JSON.parse(readFileSync(handoffPath, "utf8")) };
  }

  const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  const sv = validateHandoffSchema(handoff, DOCS_SCHEMA_PATH);
  if (!sv.valid) {
    writeHandoff(handoffPath, {
      phase: mode,
      status: "BLOCKED",
      findings: [],
      artifacts: {},
      doc_path: docPath,
      blocker: `docs handoff schema invalid: ${sv.reason} → fix the handoff JSON at ${handoffPath} and re-run ${mode}`,
    });
    return { exitCode: 1, handoff: JSON.parse(readFileSync(handoffPath, "utf8")) };
  }

  return { exitCode: code, handoff };
}
