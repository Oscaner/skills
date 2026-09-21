// packages/cdd-engine/src/cli/help.ts — `cdd help` discovery output (P2 T1 ②; overall v1.10
// Non-goal#1 carve-out — the engine's one legitimate new subcommand). Prints the cdd CLI's absolute
// directory + the required doc-resource directories (canonical doc-structure schemas / templates)
// so AI authoring agents can locate them at runtime — zero enforcement logic, no audit trigger, no
// exit-semantics change. The bin thin entry intercepts `cdd help` before the root bootstrap, so it
// works outside git repos and writes no lifecycle state. Every printed path is verified to exist at
// render time (the discovery contract: paths are real, not projected).
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { invariant } from "../infra/exit.ts";
import { resolvePackageRoot } from "../infra/resource.ts";
import { resolveDocSchemaDir } from "../documents/schema.ts";
import { fileURLToPath } from "node:url";

/** Absolute directory of the running cdd CLI artifact. realpath resolves the .bin symlink target
 * and relative invocations (node packages/cdd-engine/dist/cli.mjs) to the file's true location. */
export function cliDirectory(): string {
  const entry = process.argv[1];
  invariant(entry, "cannot resolve the cdd CLI directory (process.argv[1] is empty)");
  try {
    return path.dirname(realpathSync(entry));
  } catch {
    return path.dirname(path.resolve(entry));
  }
}

/** The packaged templates resource directory (<pkg>/templates — contract + handoff schemas). */
export function templatesDirectory(): string {
  const root = resolvePackageRoot(path.dirname(fileURLToPath(import.meta.url)));
  const dir = path.join(root, "templates");
  invariant(existsSync(dir), `templates directory not found: ${dir}`);
  return dir;
}

/** The canonical doc-structure schemas directory (published addressable path; see
 * documents/schema.ts resolveDocSchemaDir). */
export function schemaDirectory(): string {
  const dir = resolveDocSchemaDir();
  invariant(existsSync(dir), `schemas directory not found: ${dir}`);
  return dir;
}

/** The help text — deterministic `key: <absolute path>` lines, one per discovered resource. */
export function renderHelpText(): string {
  return [
    "cdd — CDD engine resource discovery",
    "",
    `cli: ${cliDirectory()}`,
    `schemas: ${schemaDirectory()}`,
    `templates: ${templatesDirectory()}`,
    "",
  ].join("\n");
}

/** Print the discovery text to stdout. */
export function runHelp(): void {
  process.stdout.write(renderHelpText());
}