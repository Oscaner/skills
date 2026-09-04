#!/usr/bin/env node
// bin/engine/docs-task.mjs — docs CLI (review + fix modes). Replaces cdd-review.mjs.
// Usage: docs-task.mjs --harness <name> --mode review|fix --template <name> --doc <path> [--findings <path>] [-h]
import { parseArgs } from "node:util";
import path from "node:path";
import { runDocsTask } from "./lib/docs-runner.mjs";
import { exitWithCode } from "../utils/exit.mjs";
// Note: ../utils/exit.mjs verified to exist at packages/osuperpowers/bin/utils/exit.mjs.

const USAGE = "usage: docs-task.mjs --harness <name> --mode review|fix --template <name> --doc <path> [--findings <path>] [-h/--help]";
const VALID_MODES = ["review", "fix"];
const NO_FIX_TEMPLATES = ["branch-review"];

const { values } = parseArgs({
  options: {
    harness:   { type: "string" },
    mode:      { type: "string" },
    template:  { type: "string" },
    doc:       { type: "string" },
    findings:  { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: false,
  allowPositionals: true,
});

// Parse --param KEY=VALUE args (supports multiple; e.g. --param SPEC=<path>)
const extraParams = {};
for (let i = 2; i < process.argv.length - 1; i++) {
  if (process.argv[i] === "--param") {
    const eq = process.argv[i + 1].indexOf("=");
    if (eq > 0) {
      extraParams[process.argv[i + 1].slice(0, eq)] = process.argv[i + 1].slice(eq + 1);
    }
  }
}

if (values.help) { process.stdout.write(USAGE + "\n"); exitWithCode(0); }
if (!values.harness || !values.mode || !values.template || !values.doc) {
  process.stderr.write(USAGE + "\n"); exitWithCode(2);
}
if (!VALID_MODES.includes(values.mode)) {
  process.stderr.write(`docs-task: --mode must be review|fix (got: ${values.mode})\n`); exitWithCode(2);
}
if (values.mode === "fix" && NO_FIX_TEMPLATES.includes(values.template)) {
  process.stderr.write(`docs-task: --template ${values.template} does not support --mode fix\n`); exitWithCode(2);
}

const dryRun = process.env.DOCS_DRY_RUN === "1";
const round = parseInt(process.env.DOCS_ROUND ?? "1");
const slug = path.basename(values.template); // e.g. "spec-review"
const slugBase = slug.replace(/-review$/, ""); // "spec" — strip suffix for fix filename
const handoffFile = values.mode === "review"
  ? `${slug}-${round}.json`          // spec-review-1.json
  : `${slugBase}-fix-${round}.json`; // spec-fix-1.json
const workspace = path.dirname(values.doc);
const handoffPath = path.join(workspace, handoffFile);

const result = await runDocsTask(values.mode, {
  harness: values.harness,
  template: values.template,
  docPath: values.doc,
  findingsPath: values.findings,
  handoffPath,
  round,
  dryRun,
  extraParams,  // passed through to renderTemplate for {{SPEC}} etc.
});

process.stdout.write(`status: ${result.handoff.status}\n`);
if (result.handoff.blocker) process.stdout.write(`blocker: ${result.handoff.blocker}\n`);
exitWithCode(result.exitCode);
