// packages/cdd-engine/src/cli/__tests__/issue-render.test.ts — `cdd issue render` (P4.2 Task 6):
// the aggregate-issue-body renderer subcommand (stdin findings JSON → stdout aggregate body).
// Black-box coverage mirrors the retired report-templates.mjs CLI face:
//   - valid stdin → exit 0 + stdout byte-identical to the atomic body golden (GOLDEN_BODY + the
//     CLI's terminating newline), stderr empty;
//   - zero enforcement: works with NO host harness env (cleanEnv deletes the CDD_* and harness
//     markers), stdout carries no `status:`/`CDD_*` envelope;
//   - invalid stdin (empty findings / illegal type / malformed JSON) → exit 1 + the offending
//     field path on stderr — the E-3 / R2 contract surface, zero regression;
//   - usage face: `cdd issue` (leaf missing) → citty E_NO_COMMAND normalized to the issue usage
//     line + exit 2.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { execaSync } from "execa";
import { describe, expect, it } from "vitest";
import {
  GOLDEN_BODY,
  INPUT,
  SINGLE_FINDING_BODY,
  VALID_FINDING,
  validInput,
} from "../../domain/__tests__/issue-report-fixtures.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const PKG_ROOT = path.join(REPO_ROOT, "packages", "cdd-engine");
const CDD_TS = path.join(PKG_ROOT, "src", "bin.ts");
const NODE = process.execPath;

// Deterministic env: strip any CDD_* inherited from the orchestrator session AND the three host
// markers — issue render must not depend on a host harness (zero-enforcement black-box property).
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("CDD_")) continue;
    if (k === "CLAUDE_CODE_SESSION_ID" || k === "CURSOR_TRACE_ID" || k === "AI_AGENT") continue;
    if (typeof v === "string") env[k] = v;
  }
  return env;
}

function runCliWithInput(
  args: string[],
  input: string,
): { exitCode: number; stdout: string; stderr: string } {
  try {
    // stripFinalNewline: false — execa's default strips the trailing newline, which would break
    // the byte-identical comparison (the CLI's terminating newline is part of the stdout bytes).
    const r = execaSync(NODE, [CDD_TS, ...args], {
      cwd: REPO_ROOT,
      env: cleanEnv(),
      input,
      encoding: "utf8",
      extendEnv: false,
      stripFinalNewline: false,
    });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    return {
      exitCode: (e as { exitCode?: number }).exitCode ?? 1,
      stdout: (e as { stdout?: string }).stdout ?? "",
      stderr: (e as { stderr?: string }).stderr ?? "",
    };
  }
}

describe("cdd issue render (P4.2 Task 6)", () => {
  it("valid stdin → exit 0, stdout byte-identical to the aggregate-body golden + terminating newline, stderr empty", () => {
    const r = runCliWithInput(["issue", "render"], JSON.stringify(INPUT));
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe(`${GOLDEN_BODY}\n`);
  });

  it("zero enforcement: no host harness env required, stdout is exactly the body (no status:/CDD_* envelope)", () => {
    // cleanEnv above already deletes the host markers — exit 0 proves no harness gate.
    const r = runCliWithInput(["issue", "render"], JSON.stringify(validInput()));
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe(`${SINGLE_FINDING_BODY}\n`);
    expect(r.stdout).not.toMatch(/status: |CDD_/);
  });

  it("empty findings → exit 1 + the findings field path on stderr", () => {
    const r = runCliWithInput(
      ["issue", "render"],
      JSON.stringify({ ...validInput(), findings: [] }),
    );
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("Invalid cdd-report input:");
    expect(r.stderr).toContain("findings: must not be empty");
  });

  it("illegal type → exit 1 + the findings[0].type field path on stderr", () => {
    const r = runCliWithInput(
      ["issue", "render"],
      JSON.stringify({ ...validInput(), findings: [{ ...VALID_FINDING, type: "critical" }] }),
    );
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("findings[0].type: must be one of bug | enhancement");
  });

  it("malformed JSON → exit 1 + the input field path on stderr", () => {
    const r = runCliWithInput(["issue", "render"], "{ not json");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("input: invalid JSON");
  });

  it("missing leaf (`cdd issue`) → citty E_NO_COMMAND normalized to the issue usage line + exit 2", () => {
    const r = runCliWithInput(["issue"], "");
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/No command specified/);
    expect(r.stderr).toMatch(/^usage: cdd issue render\n/m);
  });
});
