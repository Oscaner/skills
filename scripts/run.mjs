#!/usr/bin/env node
/**
 * Repo automation dispatcher — the single top-level entry for scripts/.
 * Subcommands lazy-load their handlers (Commander + dynamic import), so each
 * command's dependency graph loads only on first use.
 *
 * Wired so far:
 *   emit       — regenerate unified first-party manifests (write mode)
 *   emit-check — verify emitted products are fresh (drift → exit 1)
 *   validate   — run the full 13-block validate suite
 *
 * Remaining commands (version/publish-vendor/bump-submodule/
 * apply-rules/smoke-cdd) are wired in by later tasks.
 */

import { Command } from "commander";

const program = new Command();
program.name("run").description("repo automation");

const cmd = (name, desc, fn) =>
  program
    .command(name)
    .description(desc)
    .action(async () => {
      const code = await import(fn).then((m) => m.main());
      // A numeric return is an exit code (validate main() → 1 on step failure);
      // undefined returners (emit) rely on the top-level catch for non-zero.
      if (typeof code === "number") process.exitCode = code;
    });

// emit / emit-check wired first; the remaining commands join per-task in
// subsequent tasks (note the commander subcommand name `emit-check` and the
// `validate` dispatcher in ./validate/index.mjs).
cmd("emit", "regenerate unified first-party manifests", "./emit/all.mjs");
cmd("emit-check", "verify emitted products are fresh (drift → exit 1)", "./emit/check.mjs");
cmd("validate", "run the full validate suite (13 blocks)", "./validate/index.mjs");

program.parseAsync(process.argv).catch((e) => {
  console.error(e.message);
  process.exit(1);
});