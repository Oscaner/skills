#!/usr/bin/env node
/**
 * Repo automation dispatcher — the single top-level entry for scripts/.
 * Subcommands lazy-load their handlers (Commander + dynamic import), so each
 * command's dependency graph loads only on first use.
 *
 * Wired so far:
 *   emit             — regenerate unified first-party manifests (write mode)
 *   emit-check       — verify emitted products are fresh (drift → exit 1)
 *   validate         — run the full 13-block validate suite
 *   version          — apply changesets to bump versions (--dry-run supported)
 *   publish-vendor   — assemble + publish vendored plugins (--dry-run supported)
 *   bump-submodule   — bump a vendored submodule to its latest release tag
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

// `--dry-run` declared so Commander accepts it on the release commands. The
// handler receives the parsed action args (options object, plus the position
// arg for bump-submodule); version/publish-vendor read `--dry-run` from argv.
const cmdDry = (name, desc, fn) =>
  program
    .command(name)
    .description(desc)
    .option("--dry-run", "preview without writing")
    .action(async (...args) => {
      const code = await import(fn).then((m) => m.main(...args));
      if (typeof code === "number") process.exitCode = code;
    });

cmd("emit", "regenerate unified first-party manifests", "./emit/all.mjs");
cmd("emit-check", "verify emitted products are fresh (drift → exit 1)", "./emit/check.mjs");
cmd("validate", "run the full validate suite (13 blocks)", "./validate/index.mjs");

cmdDry("version", "apply changesets to bump versions", "./release/version-packages.mjs");
cmdDry("publish-vendor", "assemble + publish vendored plugins", "./release/publish-vendor.mjs");
cmdDry("bump-submodule <name>", "bump a vendored submodule to its latest release tag", "./release/bump-submodule.mjs");

program.parseAsync(process.argv).catch((e) => {
  console.error(e.message);
  process.exit(1);
});