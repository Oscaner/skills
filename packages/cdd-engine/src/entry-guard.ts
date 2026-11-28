// packages/cdd-engine/src/entry-guard.ts — "was I invoked as the script?"
//
// INVARIANT — the question is answered on RESOLVED paths, never on the spelling npm hands a
// bin. A package bin is installed as a SYMLINK (`node_modules/.bin/cdd` → `dist/bin.js`), so
// `process.argv[1]` is the link while `import.meta.url` is the target: a guard that compares
// `path.resolve` of the two answers "no" for every consumer invocation, and the process exits
// 0 having printed nothing at all — the shape 4.21.0 shipped to consumers. Comparing
// `realpathSync` of both sides is what makes the link and its target the same entry.
//
// A predicate over two arguments and no state — two arrow consts, not a class (AGENTS.md: a
// class with no invariant to guard is a function).
import { realpathSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Whether `argv[1]` resolves — through any symlink — to the module at `selfUrl`. */
export const invokedAs = (selfUrl: string, argv: readonly string[]): boolean => {
  const invoked = argv[1];
  if (invoked === undefined) return false;
  const self = fileURLToPath(selfUrl);
  if (path.resolve(invoked) === self) return true;
  try {
    return realpathSync(invoked) === realpathSync(self);
  } catch {
    // An argv[1] that cannot be resolved names no file of ours: not this entry.
    return false;
  }
};

/** The current process's answer — the only form `bin.ts` calls. */
export const isThisProcess = (selfUrl: string): boolean => invokedAs(selfUrl, process.argv);
