// packages/cdd-engine/src/cli/__tests__/host-detection.test.ts
// cdd implement/review/fix take no harness flag — the host harness resolves from the ambient
// session (detectCurrentHarness: the harness ORDER in infra/harness.ts is the single decision
// source — SPECIFIC markers first, GENERIC last). The table below pins the full detection
// matrix: five single-marker cases (CURSOR_TRACE_ID → cursor / CLAUDE_CODE_SESSION_ID → claude /
// AI_AGENT=claude-code* → claude / AI_AGENT=pi → pi / unknown AI_AGENT=codex → ""), the priority
// matrix (a SPECIFIC marker beats the GENERIC AI_AGENT=pi marker — CURSOR_TRACE_ID+pi → cursor,
// CLAUDE_CODE_SESSION_ID+pi → claude; all markers absent → "") and the bare {} empty env. Empty
// host → CDD_BLOCKED + exit 1.
// Crucially, the no-host env MUST explicitly delete all three host markers — a parent
// orchestrator session may set CLAUDE_CODE_SESSION_ID / AI_AGENT (B1 blocker), so merely
// stripping CDD_* leaks host detection into the child.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { execaSync } from "execa";
import { expect, it } from "vitest";
// Test seam: detectCurrentHarness is exported from cli/shared — the single host-fact source the
// CLI consumes (the black-box origin cases below verify the real resolution path on the dist CLI).
import { detectCurrentHarness } from "../shared.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const CDD_MJS = path.join(REPO_ROOT, "packages/cdd-engine/dist/cli.mjs");
const PLAN_FIXTURE = path.join(
  REPO_ROOT,
  "packages/cdd-engine/src/cli/__tests__/fixtures/smoke-plan.md",
);
const NODE = process.execPath;

// Full-replacement child env from scratch (PATH only + test extras) — parent CDD_* / host
// markers cannot leak in (extendEnv:false). noHost deletes the three host markers explicitly.
interface RunCliOpts {
  env?: Record<string, string | undefined>;
  cwd?: string;
  noHost?: boolean;
}
function runCli(args: string[] = [], opts: RunCliOpts = {}) {
  const { env: extraEnv = {}, cwd = REPO_ROOT, noHost = false } = opts;
  const childEnv: Record<string, string | undefined> = { PATH: process.env.PATH, ...extraEnv };
  if (noHost) {
    delete childEnv.CLAUDE_CODE_SESSION_ID;
    delete childEnv.CURSOR_TRACE_ID;
    delete childEnv.AI_AGENT;
  }
  try {
    const r = execaSync(NODE, [CDD_MJS, ...args], {
      cwd,
      env: childEnv,
      encoding: "utf8",
      extendEnv: false,
    });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e: unknown) {
    // child_process boundary cast: an execa rejection carries exitCode/stdout/stderr — narrow
    // once at the seam.
    const err = e as { exitCode?: number; stdout?: string; stderr?: string };
    return { exitCode: err.exitCode ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

// ---- origin cases (black-box on the dist CLI: host absence blocks, each origin passes dry-run) ----

it("无 host env → cdd implement BLOCK exit 1 + CDD_BLOCKED", () => {
  const r = runCli(["implement", "--tasks", "1", "--plan", PLAN_FIXTURE], { noHost: true });
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toMatch(/no host harness|CDD_BLOCKED/);
});

it("CLAUDE_CODE_SESSION_ID=1 → claude origin 判定成功（dry-run exit 0）", () => {
  const r = runCli(["--dry-run", "implement", "--tasks", "1", "--plan", PLAN_FIXTURE], {
    env: { CLAUDE_CODE_SESSION_ID: "1" },
  });
  expect(r.exitCode).toBe(0);
});

it("CURSOR_TRACE_ID=1 → cursor origin 判定成功（dry-run exit 0）", () => {
  const r = runCli(["--dry-run", "implement", "--tasks", "1", "--plan", PLAN_FIXTURE], {
    env: { CURSOR_TRACE_ID: "1" },
  });
  expect(r.exitCode).toBe(0);
});

it("AI_AGENT=pi → pi origin 判定成功（dry-run exit 0）", () => {
  const r = runCli(["--dry-run", "implement", "--tasks", "1", "--plan", PLAN_FIXTURE], {
    env: { AI_AGENT: "pi" },
  });
  expect(r.exitCode).toBe(0);
});

// ---- the detectCurrentHarness unit table (the seam the CLI consumes) ----
// Single-marker (five), the SPECIFIC-over-GENERIC priority matrix (three, incl. all-markers
// absent) + the bare {} empty env; the SPECIFIC-vs-SPECIFIC tie-break stays pinned too
// (CURSOR_TRACE_ID beats CLAUDE_CODE_SESSION_ID — the ORDER datum).
it.each([
  // single-marker cases — each origin detectable from one host marker
  ["CURSOR_TRACE_ID → cursor", { CURSOR_TRACE_ID: "1" }, "cursor"],
  ["CLAUDE_CODE_SESSION_ID → claude", { CLAUDE_CODE_SESSION_ID: "1" }, "claude"],
  ["AI_AGENT=claude-code* → claude", { AI_AGENT: "claude-code-1.0" }, "claude"],
  ["AI_AGENT=pi → pi", { AI_AGENT: "pi" }, "pi"],
  ["AI_AGENT 非 claude/pi → empty", { AI_AGENT: "codex" }, ""],
  // priority matrix — a SPECIFIC marker wins over the GENERIC AI_AGENT=pi marker
  ["CURSOR_TRACE_ID + AI_AGENT=pi → cursor", { CURSOR_TRACE_ID: "1", AI_AGENT: "pi" }, "cursor"],
  [
    "CLAUDE_CODE_SESSION_ID + AI_AGENT=pi → claude",
    { CLAUDE_CODE_SESSION_ID: "1", AI_AGENT: "pi" },
    "claude",
  ],
  ["全 marker 缺席（PATH only）→ empty", { PATH: "/usr/bin" }, ""],
  // SPECIFIC-vs-SPECIFIC tie-break + empty env
  [
    "CURSOR_TRACE_ID 优先于 CLAUDE_CODE_SESSION_ID → cursor",
    { CURSOR_TRACE_ID: "1", CLAUDE_CODE_SESSION_ID: "1" },
    "cursor",
  ],
  ["{} empty env → empty", {}, ""],
])("%s", (_t, env, expected) => {
  expect(detectCurrentHarness(env)).toBe(expected);
});
