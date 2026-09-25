// packages/cdd-engine/src/infra/root.ts — repoRoot conversion point of the rebuilt infra layer.
// Guard note: src/infra/root.mjs is validate's single cwd-read anchor (channel audit ①, §2.4.1).
// This TS port takes cwd as an explicit parameter — it introduces NO second read token — and
// resolves the repo root through infra/git.ts (gitTopLevel), the single git point. Consumers of
// the rebuilt layer pass cwd from their own boundary; when root.mjs is retired (Task 8/9) the
// single read site moves here.
// resolveDocArg keeps the exact same single-coordinate contract as root.mjs (repo-root-relative
// normalize; missing → CDD_BLOCKED 3-line diagnostic + exit 1 via exitWithCode — a THROW, so the
// withLifecycle finally blocks still unwind).
import { existsSync } from "node:fs";
import path from "node:path";
import { exitWithCode, invariant } from "./exit.ts";
import { gitTopLevel } from "./git.ts";

let _root: string | null = null;

export async function initRoot(cwd: string): Promise<string> {
  const root = await gitTopLevel(cwd);
  if (!root) {
    process.stderr.write(
      "CDD_BLOCKED: not in a git repository\n  Run cdd from within a git repository.\n",
    );
    exitWithCode(1);
  }
  _root = root;
  return root;
}

export function getRoot(): string {
  invariant(_root, "initRoot() not called — call from bin/cdd.mjs entry first");
  return _root;
}

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
