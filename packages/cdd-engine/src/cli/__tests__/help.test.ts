// packages/cdd-engine/src/cli/__tests__/help.test.ts — `cdd help` discovery subcommand
// (P2 T1 ②/③; overall v1.10 Non-goal#1 carve-out · AC5). Coverage:
//   - the CLI black-box help output (dev face): exit 0 + the three absolute dirs, each verified to
//     exist on disk, with the expected contents (cli.mjs / the four schema files / the templates
//     contract);
//   - zero-enforcement properties: works outside a git repo (pre-boot intercept, no initRoot gate),
//     writes no lifecycle state (no .osuperpowers/cdd created), triggers no audit / dispatch;
//   - the `--help` surface lists the new help subcommand within the five-subcommand main
//     description (implement/review/fix/base-branch/help); the `-h → help` pin in cdd.test keeps
//     matching the same prefix;
//   - unit surface: renderHelpText shape + the resolver seam (cliDirectory / templatesDirectory /
//     schemaDirectory) returning existing paths.
// Unlike the other CLI shapes' dry-run smoke, help never reaches the entry gate — no clean-tree
// dependence, it stays green on a dirty dev tree (pre-boot resource discovery only).
import { describe, it, expect } from "vitest";
import { execaSync } from "execa";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHelpText, cliDirectory, templatesDirectory, schemaDirectory } from "../help.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const CDD_MJS = path.join(REPO_ROOT, "packages/cdd-engine/dist/cli.mjs");
const NODE = process.execPath;
const SCHEMA_NAMES = ["overall", "plan", "phase-spec", "add-phase-protocol"];

function cleanEnv(extra: Record<string, string | undefined> = {}) {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_") && typeof v === "string") env[k] = v;
  }
  return { ...env, ...extra };
}

function runCli(args: string[], opts: { cwd?: string } = {}) {
  try {
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd: opts.cwd ?? REPO_ROOT, env: cleanEnv(), encoding: "utf8", extendEnv: false });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    return { exitCode: (e as { exitCode?: number }).exitCode ?? 1, stdout: (e as { stdout?: string }).stdout ?? "", stderr: (e as { stderr?: string }).stderr ?? "" };
  }
}

function parseHelp(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const m = line.match(/^(cli|schemas|templates): (.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

describe("cdd help (P2 T1 discovery subcommand)", () => {
  it("black-box dev face: exit 0 + the three absolute dirs, each existing on disk with expected content", () => {
    const r = runCli(["help"]);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe("");
    const dirs = parseHelp(r.stdout);
    expect(Object.keys(dirs).sort()).toEqual(["cli", "schemas", "templates"]);
    for (const v of Object.values(dirs)) expect(path.isAbsolute(v)).toBe(true);
    // cli dir = the dist containing the running artifact
    expect(existsSync(path.join(dirs.cli, "cli.mjs"))).toBe(true);
    expect(dirs.cli).toBe(path.dirname(CDD_MJS));
    // schemas dir holds the four canonical files
    for (const n of SCHEMA_NAMES) expect(existsSync(path.join(dirs.schemas, `${n}.json`))).toBe(true);
    // templates dir holds the shipped contract + handoff schemas
    expect(existsSync(path.join(dirs.templates, "template-contract.json"))).toBe(true);
    expect(existsSync(path.join(dirs.templates, "engine-config.json"))).toBe(true);
  });

  it("zero-enforcement: runs outside a git repo (pre-boot intercept — no initRoot gate), exit 0", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-help-nogit-"));
    try {
      const r = runCli(["help"], { cwd: dir });
      expect(r.exitCode).toBe(0);
      expect(r.stderr).toBe("");
      const dirs = parseHelp(r.stdout);
      for (const v of Object.values(dirs)) expect(existsSync(v)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("zero-enforcement: writes no lifecycle state, triggers no audit (no .osuperpowers/cdd, no dispatch output)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-help-nolifecycle-"));
    try {
      execaSync("git", ["-C", dir, "init", "-q"]);
      execaSync("git", ["-C", dir, "-c", "user.name=cdd-test", "-c", "user.email=cdd-test@example.com", "commit", "--allow-empty", "-qm", "fixture"]);
      const r = runCli(["help"], { cwd: dir });
      expect(r.exitCode).toBe(0);
      // help output is purely the discovery text — no return block, no audit, no CDD_* diagnostics
      expect(r.stdout).not.toMatch(/status: /);
      expect(r.stderr).not.toMatch(/CDD_/);
      // no lifecycle/workspace side effect at the repo root
      expect(existsSync(path.join(dir, ".osuperpowers"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("`--dry-run` position before the subcommand is tolerated (program-level flag, any position)", () => {
    const r = runCli(["--dry-run", "help"]);
    expect(r.exitCode).toBe(0);
    expect(parseHelp(r.stdout)).toHaveProperty("cli");
  });

  it("`--help` surface lists the new help subcommand within the five-subcommand main description", () => {
    const r = runCli(["--help"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/CDD engine CLI — implement\/review\/fix\/base-branch\/help/);
    expect(r.stdout).not.toMatch(/\bbrief\b|\bresearch\b/);
  });
});

describe("cdd help unit surface (path resolution)", () => {
  it("renderHelpText: key: <absolute path> lines, exactly one trailing newline, no blank tail", () => {
    const text = renderHelpText();
    const lines = text.split("\n");
    expect(lines[0]).toBe("cdd — CDD engine resource discovery");
    expect(lines[1]).toBe("");
    for (const label of ["cli", "schemas", "templates"]) {
      const m = lines.find((l) => l.startsWith(`${label}: `));
      expect(m).toBeDefined();
      const value = m!.slice(`${label}: `.length);
      expect(path.isAbsolute(value)).toBe(true);
    }
    expect(lines.at(-1)).toBe(""); // trailing newline → last split segment is empty
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false); // exactly one trailing newline, no trailing blank line
  });

  it("cliDirectory / templatesDirectory / schemaDirectory resolve to existing directories", () => {
    for (const dir of [cliDirectory(), templatesDirectory(), schemaDirectory()]) {
      expect(existsSync(dir)).toBe(true);
    }
    // cliDirectory depends on the running process argv[1] — under vitest that is the vitest binary,
    // so the dist/cli.mjs content assertion belongs to the black-box help test (real argv[1]).
    expect(existsSync(path.join(templatesDirectory(), "template-contract.json"))).toBe(true);
    expect(existsSync(path.join(schemaDirectory(), "overall.json"))).toBe(true);
  });
});
