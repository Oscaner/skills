// packages/cdd-engine/src/infra/root.ts — repoRoot conversion point of the rebuilt infra layer.
// Guard note: src/infra/root.mjs is validate's single cwd-read anchor (channel audit ①, §2.4.1).
// P4.4 Task 4 "CddRuntime module-state consolidation": the `_root` singleton + initRoot/getRoot moved into
// infra/runtime.ts (the CddRuntime class owns the root state — the class is the single mutable
// surface; this file re-exports the same identities so legacy imports keep resolving here).
// resolveDocArg keeps the exact same single-coordinate contract as root.mjs (repo-root-relative
// normalize; missing → CDD_BLOCKED 3-line diagnostic + exit 1 via exitWithCode — a THROW, so the
// withLifecycle finally blocks still unwind). This TS port takes cwd as an explicit parameter — it
// introduces NO second read token.
import { existsSync } from "node:fs";
import path from "node:path";
import { exitWithCode } from "./exit.ts";

export { getRoot, initRoot } from "./runtime.ts";

export function resolveDocArg(arg: string, root: string, flag = "path"): string {
  if (path.isAbsolute(arg)) {
    if (existsSync(arg)) return arg;
    process.stderr.write(
      `CDD_BLOCKED: --${flag} not found: ${arg}\n` +
        `  Absolute path does not exist.\n` +
        `  Hint: pass a repo-root-relative path instead.\n`,
    );
    exitWithCode(1);
  }
  const resolved = path.join(root, arg);
  if (existsSync(resolved)) return resolved;
  process.stderr.write(
    `CDD_BLOCKED: --${flag} not found: ${arg}\n` +
      `  Tried (against repo root ${root}): ${resolved}\n` +
      `  Hint: cdd resolves paths against the repo root. Verify the path is correct relative to the repo root.\n`,
  );
  exitWithCode(1);
}
