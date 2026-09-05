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
 *   smoke-cdd        — cdd-engine dry-run smoke (4-command H1 chain)
 *   version          — apply changesets to bump versions (--dry-run supported)
 *   publish-vendor   — assemble + publish vendored plugins (--dry-run supported)
 *   bump-submodule   — bump a vendored submodule to its latest release tag
 *   apply-rules      — apply a GitHub branch Ruleset (protect-develop | protect-main)
 */

import { Command } from "commander";

const program = new Command();
program.name("run").description("repo automation");

// Register a subcommand that lazy-loads its handler module and forwards the
// Commander action args to the module's main(). The action body is shared by
// the whole family; opts tailors the two genuine variances:
//   dryRun — declare --dry-run so Commander accepts it on the release commands.
//     The parsed options object is forwarded with the action args, so each
//     release main reads its `dryRun` from there (authoritative when present);
//     the isMain direct-run wrappers fall back to `process.argv` for `--dry-run`.
//   args — "all" (default) forwards the full argv; "operand" forwards only the
//     first positional (apply-rules main(target) — trailing options/command
//     objects dropped); "none" forwards nothing, for zero-arg mains (validate's
//     main(stepsArg = steps) must never see an options object in that slot).
const command = (name, desc, fn, { dryRun = false, args = "all" } = {}) => {
  const cmd = program.command(name).description(desc);
  if (dryRun) cmd.option("--dry-run", "preview without writing");
  cmd.action(async (...actionArgs) => {
    const forwarded = args === "none" ? [] : args === "operand" ? actionArgs.slice(0, 1) : actionArgs;
    const code = await import(fn).then((m) => m.main(...forwarded));
    // A numeric return is an exit code (validate main() → 1 on step failure);
    // undefined returners (emit) rely on the top-level catch for non-zero.
    if (typeof code === "number") process.exitCode = code;
  });
};

command("emit", "regenerate unified first-party manifests", "./emit/all.mjs", { args: "none" });
command("emit-check", "verify emitted products are fresh (drift → exit 1)", "./emit/check.mjs", { args: "none" });
command("validate", "run the full validate suite (13 blocks)", "./validate/index.mjs", { args: "none" });
command("smoke-cdd", "run cdd-engine dry-run smoke (4-command H1 chain)", "./validate/smoke-cdd.mjs", { args: "none" });

command("version", "apply changesets to bump versions", "./release/version-packages.mjs", { dryRun: true });
command("publish-vendor", "assemble + publish vendored plugins", "./release/publish-vendor.mjs", { dryRun: true });
command("bump-submodule <name>", "bump a vendored submodule to its latest release tag", "./release/bump-submodule.mjs", { dryRun: true });

// Single mandatory positional but no options: forward only the operand.
command("apply-rules <target>", "apply a GitHub branch Ruleset (protect-develop | protect-main)", "./rulesets/apply.mjs", { args: "operand" });

program.parseAsync(process.argv).catch((e) => {
  console.error(e.message);
  process.exit(1);
});