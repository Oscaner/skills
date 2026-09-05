import { describe, it, expect } from "vitest";
import { execa } from "execa";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const run = (args) =>
  execa("node", ["scripts/run.mjs", ...args], { cwd: ROOT, reject: false });

describe("run.mjs apply-rules wiring", () => {
  it("is listed in the subcommand help with both targets", async () => {
    const { stdout, exitCode } = await run(["apply-rules", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/apply-rules/);
    expect(stdout).toMatch(/protect-develop/);
    expect(stdout).toMatch(/protect-main/);
  });

  it("rejects an unknown target with usage on stderr and exit 1", async () => {
    const { stderr, exitCode } = await run(["apply-rules", "bogus"]);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/Usage: run\.mjs apply-rules <protect-develop\|protect-main>/);
  });
});