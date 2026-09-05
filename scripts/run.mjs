#!/usr/bin/env node
/**
 * Repo automation dispatcher — the single top-level entry for scripts/.
 * Subcommands lazy-load their handlers (Commander + dynamic import), so each
 * command's dependency graph loads only on first use.
 *
 * Wired so far:
 *   emit       — regenerate unified first-party manifests (write mode)
 *   emit-check — verify emitted products are fresh (drift → exit 1)
 *
 * Remaining commands (validate/version/publish-vendor/bump-submodule/
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
      await import(fn).then((m) => m.main());
    });

// emit / emit-check wired first; the remaining commands join per-task in
// subsequent tasks (note the commander subcommand name `emit-check`).
cmd("emit", "regenerate unified first-party manifests", "./emit/all.mjs");
cmd("emit-check", "verify emitted products are fresh (drift → exit 1)", "./emit/check.mjs");

program.parseAsync(process.argv).catch((e) => {
  console.error(e.message);
  process.exit(1);
});