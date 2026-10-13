// packages/cdd-engine/src-next/__tests__/bin.test.ts
// T13 — the bin-bootstrap face, black-box: the thin entry's cli-load + exit-code
// plumbing exercised exactly the way the checkable runs it (`node src-next/bin.ts …`).
// Spawns the source entry straight (Node >=22.18 native type stripping — the dev
// face; the test asserts through the steady exit-code table — 0 = OK · 2 = usage —
// not through anything imported in-process: the bin is only ever executed, never
// imported).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const BIN = fileURLToPath(new URL("../bin.ts", import.meta.url));

/** One spawned bin run — fail-open (a non-zero child rides the code, never a throw;
 *  the child's streams are piped, never inherited into the reporter). */
const run = (
  args: readonly string[],
  opts: { cwd?: string; input?: string } = {},
): { code: number; stdout: string; stderr: string } => {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    encoding: "utf8",
    cwd: opts.cwd ?? process.cwd(),
    input: opts.input,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    code: result.status ?? (result.error !== undefined ? 1 : 0),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

describe("the T9 deliberate pin — the NodeEnvGuard + Cli.create entry (the class-face boot)", () => {
  it("the entry is the NodeEnvGuard class member + the Cli.create factory — zero module-level functions in bin.ts", () => {
    // bin.ts is only ever executed, never imported, so the entry form is pinned
    // from its source: the environment pre-flight is a class static judgement and
    // the CLI face boots through the Cli.create static factory — a regression to a
    // module-level `bootEnvironmentProblem`/`cli` function trips this pin.
    const src = readFileSync(BIN, "utf8");
    expect(src).not.toMatch(/^(export )?(async )?function /m);
    expect(src).toMatch(/class NodeEnvGuard/);
    expect(src).toMatch(/NodeEnvGuard\.problem\(\)/);
    expect(src).toMatch(/const \{ Cli \} = await import\("\.\/face\/cli\.ts"\)/);
    expect(src).toMatch(/Cli\.create\(\)\.runArgv/);
  });

  it("the environment guard's message + exit bytes are pinned (the below-floor word face)", () => {
    const src = readFileSync(BIN, "utf8");
    // The byte message is produced from the NODE_FLOOR row — both the floor and the
    // template production are pinned so the below-floor word face cannot drift.
    expect(src).toContain("const NODE_FLOOR = { major: 22, minor: 18 } as const;");
    expect(src).toMatch(
      /cdd requires Node >= \$\{NODE_FLOOR\.major\}\.\$\{NODE_FLOOR\.minor\} \(native type stripping\) — installed: \$\{process\.versions\.node\}/,
    );
    expect(src).toContain("process.exit(1)");
  });
});

describe("the bin bootstrap — cli load + exit-code plumbing (black-box)", () => {
  it("`node src-next/bin.ts schema get plan` prints the derived plan schema + exits 0 (the T13 checkable)", () => {
    const result = run(["schema", "get", "plan"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      docType: string;
      $schema: string;
      properties: Record<string, unknown>;
    };
    // The derived doc-structure schema — the registration-derived face, never a
    // hand-written second schema.
    expect(parsed.docType).toBe("plan");
    expect(parsed.$schema).toContain("json-schema.org");
    expect(parsed.properties).toBeTypeOf("object");
    expect(Object.keys(parsed.properties).length).toBeGreaterThan(0);
  });

  it("an unknown flag exits 2 with commander's unknown-option byte + the native did-you-mean (the guardArgs semantics ride the bin)", () => {
    // the required flags must be satisfied first — commander's missing-required
    // check fires before the unknown-option scan, so the typo surfaces only with
    // --tasks/--plan present
    const result = run(["implement", "--tasks", "2", "--plan", "p.md", "--taks"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("error: unknown option '--taks'");
    expect(result.stderr).toContain("(Did you mean --tasks?)");
  });

  it("an unknown command exits 2 with commander's unknown-command byte", () => {
    const result = run(["bogus"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("error: unknown command 'bogus'");
  });

  it("a missing required flag exits 2 with the .requiredOption() byte (base get's required --plan)", () => {
    const result = run(["base", "get"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("error: required option '--plan <path>' not specified");
  });

  it("`node src-next/bin.ts issue render` renders the aggregate body from stdin + exits 0", () => {
    const input = JSON.stringify({
      harness: "claude",
      findings: [
        {
          type: "bug",
          lang: "en",
          context: "c",
          problem: "p",
          impact: "i",
          suggestedFix: "f",
          meta: { skill: "tdd", step: "loop" },
        },
      ],
    });
    const result = run(["issue", "render"], { input });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("# CDD aggregate issue");
    expect(result.stdout).toContain("## Context");
    expect(result.stdout).toContain("- Skill: tdd");
  });

  it("issue render rejects malformed input JSON with exit 1 (the input-value failure surface)", () => {
    const result = run(["issue", "render"], { input: "not json" });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("invalid input JSON");
  });
});
