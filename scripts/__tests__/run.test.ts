// scripts/__tests__/run.test.ts — Task 21: run.ts citty CLI surface. Pins the
// value-passing contract between the subcommand run() handlers and the lazily-loaded module
// mains (invocationArgs), the command-tree shape, and the P5 §2.4.2 exit-code table via
// black-box spawns of `node scripts/run.ts`.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

import { invocationArgs, mainCommand } from "../run.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const runCli = (args: string[]) =>
  execa("node", ["scripts/run.ts", ...args], { cwd: ROOT, reject: false });

const sub = (name: string) =>
  (
    mainCommand.subCommands as Record<
      string,
      { meta: { name: string }; args: Record<string, unknown> }
    >
  )[name];

describe("run.ts command tree (citty Task 21)", () => {
  it("declares exactly the seven administrative subcommands", () => {
    const keys = Object.keys(mainCommand.subCommands as Record<string, unknown>);
    expect([...keys].sort()).toEqual(
      ["apply-rules", "emit", "emit-check", "precommit", "smoke-cdd", "validate", "version"].sort(),
    );
  });

  it("version declares a presence-based --dry-run boolean (no default → undefined when absent)", () => {
    const args = sub("version").args;
    expect(args["dry-run"]).toEqual({ type: "boolean", description: "preview without writing" });
  });

  it("apply-rules declares its single mandatory positional target", () => {
    const args = sub("apply-rules").args;
    expect(args.target).toEqual({
      type: "positional",
      description: "protect-develop | protect-main",
    });
  });
});

describe("run.ts invocationArgs — subcommand value passing", () => {
  it("zero-arg mains get no forwarded arguments (validate must never see an options object)", () => {
    expect(invocationArgs("none", {})).toEqual([]);
  });

  it("version forwards presence-based dryRun: present → true, absent → false", () => {
    expect(invocationArgs("dry-run", { "dry-run": true })).toEqual([{ dryRun: true }]);
    expect(invocationArgs("dry-run", {})).toEqual([{ dryRun: false }]);
  });

  it("apply-rules forwards its required positional target", () => {
    expect(invocationArgs("target", { target: "protect-develop" })).toEqual(["protect-develop"]);
  });
});

describe("run.ts exit-code table (P5 §2.4.2, engine parity)", () => {
  it("root --help exits 0 and lists all seven subcommands", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    expect(exitCode).toBe(0);
    for (const c of [
      "emit",
      "emit-check",
      "validate",
      "precommit",
      "smoke-cdd",
      "version",
      "apply-rules",
    ]) {
      expect(stdout).toMatch(c);
    }
  });

  it("unknown subcommand → usage line + exit 2 (usage/parse error)", async () => {
    const { stderr, exitCode } = await runCli(["frobnicate"]);
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/usage: run <command> \[options\]/);
    expect(stderr).toMatch(/Unknown command frobnicate/);
  });

  it("missing required positional (apply-rules) → usage line + exit 2", async () => {
    const { stderr, exitCode } = await runCli(["apply-rules"]);
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/Missing required positional argument: TARGET/);
  });

  it("version --dry-run reaches main as dryRun (dry-run banner only, exit 0)", async () => {
    const { stdout, exitCode } = await runCli(["version", "--dry-run"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/dry-run/);
  });
});
