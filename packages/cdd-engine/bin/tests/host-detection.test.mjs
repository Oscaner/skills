// bin/tests/host-detection.test.mjs — T3: host harness detection (harness flag removed).
// cdd implement/review/fix/research no longer take a harness flag — the harness is resolved from
// the ambient host session (detectCurrentHarness markers: CURSOR_TRACE_ID → cursor-agent;
// CLAUDE_CODE_SESSION_ID / AI_AGENT=claude-code* → claude). Empty host → CDD_BLOCKED + exit 1.
// Crucially, the no-host env MUST explicitly delete all three host markers — a parent
// orchestrator session may set CLAUDE_CODE_SESSION_ID / AI_AGENT (B1 blocker), so merely
// stripping CDD_* leaks host detection into the child.
import { it, expect } from "vitest";
import { execaSync } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));   // packages/cdd-engine/bin/tests
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..");
const CDD_MJS = path.join(REPO_ROOT, "packages", "cdd-engine", "bin", "cdd.mjs");
const PLAN_FIXTURE = path.join(REPO_ROOT, "packages", "cdd-engine", "bin", "tests", "fixtures", "smoke-plan.md");
const NODE = process.execPath;

// Full-replacement child env from scratch (PATH only + test extras) — parent CDD_* / host
// markers cannot leak in (extendEnv:false). noHost deletes the three host markers explicitly.
function runCli(args = [], opts = {}) {
  const { env: extraEnv = {}, cwd = REPO_ROOT, noHost = false } = opts;
  const childEnv = { PATH: process.env.PATH, ...extraEnv };
  if (noHost) {
    delete childEnv.CLAUDE_CODE_SESSION_ID;
    delete childEnv.CURSOR_TRACE_ID;
    delete childEnv.AI_AGENT;
  }
  try {
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd, env: childEnv, encoding: "utf8", extendEnv: false });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    return { exitCode: e.exitCode ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

it("无 host env → cdd implement BLOCK exit 1 + CDD_BLOCKED", () => {
  const r = runCli(["implement", "--task", "1", "--plan", PLAN_FIXTURE], { noHost: true });
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toMatch(/no host harness|CDD_BLOCKED/);
});

it("CLAUDE_CODE_SESSION_ID=1 → host 判定成功（dry-run exit 0）", () => {
  const r = runCli(["implement", "--task", "1", "--plan", PLAN_FIXTURE],
    { env: { CLAUDE_CODE_SESSION_ID: "1", CDD_DRY_RUN: "1" } });
  expect(r.exitCode).toBe(0);
});