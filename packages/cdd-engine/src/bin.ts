#!/usr/bin/env node
// packages/cdd-engine/src/bin.ts — the new tree's composition root, reserved and left
// unwired. It exists this early because the compile face must have an input: a project
// file pointing at an empty directory is not a compile face, and the cutover wave points
// every entry surface (package.json#bin, the dev face, the smoke script) here at once —
// a root that only then appears arrives together with the errors it was supposed to
// catch earlier. Zero bare functions: the entry is an arrow const, and the scan root
// covers `src/` from this wave on, not from the cutover.
//
// The signature is the final one — one call per process, argv in, exit code out — so the
// cutover only fills the body: build the object graph here, hand the argv to the command
// surface, return its code. Until then it fails loudly rather than exiting 0 silently.

/** The CLI entry — argv in, exit code out; not wired yet, so it refuses to boot. */
export const main = async (argv: readonly string[]): Promise<number> => {
  throw new Error(`cdd: src/bin.ts is not wired yet (${argv.length} argv entries)`);
};
