// packages/cdd-engine/src/cli/__tests__/schema.test.ts — `cdd schema get <type>` (P4.3 Task 5):
// discovery-only canonical schema output, zero enforcement logic. Coverage:
//   - every DOC_SCHEMA_NAMES type prints byte-identical to its schema file (stdout IS the file —
//     no result envelope, no re-serialization), verified against the shared resolver's resolved
//     path (the exact file the CLI reads: published dist copy first, src fallback);
//   - the acceptance's published reference: in this dev tree the resolver serves the dist copy
//     (dist/documents/schema/<name>.json — the addressable consumer face);
//   - zero-enforcement properties: works with NO host harness env (schema never calls
//     requireHostHarness — no dispatch/audit/convergence surface), stderr stays empty, stdout
//     carries no `status:`/`CDD_*` envelope;
//   - unknown doc-type → usage exit 2 + available-name enumeration, registry-sourced (the same
//     DOC_SCHEMA_NAMES list, no second encoding);
//   - missing type (`cdd schema get`) / missing subcommand (`cdd schema`) → citty parse errors,
//     both normalized to the schema usage line + exit 2 (bin parse-error normalization).
// Unlike help (pre-boot intercept), schema rides the normal bootstrap (like base-branch) — runs
// from the repo root, no host required.
import { describe, it, expect } from "vitest";
import { execaSync } from "execa";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOC_SCHEMA_NAMES, resolveDocSchemaDir } from "../../documents/schema.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const PKG_ROOT = path.join(REPO_ROOT, "packages", "cdd-engine");
const CDD_MJS = path.join(PKG_ROOT, "dist", "cli.mjs");
const NODE = process.execPath;

// Test env: strip any CDD_* inherited from the orchestrator session AND the three host markers —
// schema get must not depend on a host harness (zero-enforcement black-box property under test).
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("CDD_")) continue;
    if (k === "CLAUDE_CODE_SESSION_ID" || k === "CURSOR_TRACE_ID" || k === "AI_AGENT") continue;
    if (typeof v === "string") env[k] = v;
  }
  return env;
}

function runCli(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  try {
    // stripFinalNewline: false — execa's default strips the trailing newline, which would break
    // the byte-identical comparison (the schema files' own final newline is part of the bytes).
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd: REPO_ROOT, env: cleanEnv(), encoding: "utf8", extendEnv: false, stripFinalNewline: false });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    return { exitCode: (e as { exitCode?: number }).exitCode ?? 1, stdout: (e as { stdout?: string }).stdout ?? "", stderr: (e as { stderr?: string }).stderr ?? "" };
  }
}

// The schema file the CLI serves — resolveDocSchemaDir is the single-point resolver the engine's
// loadDocSchemaText uses, so this is byte-for-byte the file the subprocess reads.
function schemaFileBytes(name: string): string {
  return readFileSync(path.join(resolveDocSchemaDir(), `${name}.json`), "utf8");
}

describe("cdd schema get <type> (P4.3 Task 5 discovery)", () => {
  it.each(DOC_SCHEMA_NAMES)("%s → exit 0, empty stderr, stdout byte-identical to the schema file", (name) => {
    const r = runCli(["schema", "get", name]);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe(schemaFileBytes(name));
  });

  it("the byte-parity reference is the published dist copy (acceptance: dist/documents/schema/<name>.json)", () => {
    const distDir = path.join(PKG_ROOT, "dist", "documents", "schema");
    // The published-present state is what the acceptance names; a src-only dev face (fresh
    // checkout pre-build) falls back legitimately — guard the dist-reference pin to the dist state.
    if (existsSync(distDir)) {
      expect(resolveDocSchemaDir()).toBe(distDir);
      expect(runCli(["schema", "get", "phase-spec"]).stdout).toBe(readFileSync(path.join(distDir, "phase-spec.json"), "utf8"));
    }
  });

  it("zero-enforcement: no host harness env (schema never calls requireHostHarness), stdout is exactly the schema bytes", () => {
    const r = runCli(["schema", "get", "overall"]);
    expect(r.exitCode).toBe(0);
    // No host env above (host markers deleted) — exit 0 proves no harness gate; the byte-exact
    // stdout (no `status:`/`CDD_*` envelope, no audit) proves no result-face/validation surface.
    expect(r.stdout).toBe(schemaFileBytes("overall"));
    expect(r.stdout).not.toMatch(/status: |CDD_/);
    expect(r.stderr).toBe("");
  });

  it("unknown doc-type → usage exit 2 + available-name enumeration (registry-sourced, five names)", () => {
    const r = runCli(["schema", "get", "bogus-type"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/^usage: cdd schema get <type>\n/m);
    expect(r.stderr).toContain("unknown schema type: bogus-type");
    // The enumeration is the registry itself — DOC_SCHEMA_NAMES.join(", "), never a second list.
    expect(r.stderr).toContain(`(available: ${DOC_SCHEMA_NAMES.join(", ")})`);
    expect(r.stdout).toBe("");
  });

  it("missing type (`cdd schema get`) → citty required-positional error, normalized to usage + exit 2", () => {
    const r = runCli(["schema", "get"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/Missing required positional argument: TYPE/);
    expect(r.stderr).toMatch(/^usage: cdd schema get <type>\n/m);
  });

  it("missing subcommand (`cdd schema`) → citty E_NO_COMMAND, normalized to usage + exit 2", () => {
    const r = runCli(["schema"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/No command specified/);
    expect(r.stderr).toMatch(/^usage: cdd schema get <type>\n/m);
  });
});
