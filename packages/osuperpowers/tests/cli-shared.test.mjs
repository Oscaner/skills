// packages/osuperpowers/tests/cli-shared.test.mjs — Tests for cli-shared.mjs
// spawnCapture timeout support + resolveTimeoutMs helper (30min stepping).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnCapture, resolveTimeoutMs } from "../bin/engine/lib/cli-shared.mjs";

// --- resolveTimeoutMs: pure-function tests ---

test("resolveTimeoutMs: no env → default 1800s", () => {
  const ms = resolveTimeoutMs({}, "task");
  assert.equal(ms, 1800_000);
});

test("resolveTimeoutMs: CDD_CLI_TIMEOUT=3600 → 3600s", () => {
  const ms = resolveTimeoutMs({ CDD_CLI_TIMEOUT: "3600" }, "task");
  assert.equal(ms, 3600_000);
});

test("resolveTimeoutMs: CDD_TASK_TIMEOUT=900 + CDD_CLI_TIMEOUT=3600 → 900s (per-mode wins)", () => {
  const ms = resolveTimeoutMs(
    { CDD_TASK_TIMEOUT: "900", CDD_CLI_TIMEOUT: "3600" },
    "task"
  );
  assert.equal(ms, 900_000);
});

test("resolveTimeoutMs: CDD_CLI_TIMEOUT=60 → 1800s (30min stepping: round up)", () => {
  const ms = resolveTimeoutMs({ CDD_CLI_TIMEOUT: "60" }, "task");
  assert.equal(ms, 1800_000);
});

test("resolveTimeoutMs: CDD_CLI_TIMEOUT=1800 → 1800s (exact boundary, no stepping)", () => {
  const ms = resolveTimeoutMs({ CDD_CLI_TIMEOUT: "1800" }, "task");
  assert.equal(ms, 1800_000);
});

test("resolveTimeoutMs: CDD_CLI_TIMEOUT=1801 → 3600s (one step up)", () => {
  const ms = resolveTimeoutMs({ CDD_CLI_TIMEOUT: "1801" }, "task");
  assert.equal(ms, 3600_000);
});

test("resolveTimeoutMs: unknown mode → falls back to global or undefined", () => {
  // No defaults for "unknown-mode", no global → returns undefined
  const ms1 = resolveTimeoutMs({}, "unknown-mode");
  assert.equal(ms1, undefined);

  // With global, unknown-mode still gets it
  const ms2 = resolveTimeoutMs({ CDD_CLI_TIMEOUT: "600" }, "unknown-mode");
  assert.equal(ms2, 1800_000); // stepped up from 600
});

// --- spawnCapture timeout ---

test("spawnCapture: timeoutMs=100 + sleep 500 → timedOut: true, code: -1", async () => {
  const res = await spawnCapture("sleep", ["500"], { timeoutMs: 100 });
  assert.equal(res.timedOut, true);
  assert.equal(res.ok, false);
  assert.equal(res.code, -1);
});

// --- spawnCapture: normal behavior unchanged ---

test("spawnCapture: normal exit → ok: true, timedOut: false", async () => {
  const res = await spawnCapture("echo", ["hello"]);
  assert.equal(res.ok, true);
  assert.equal(res.code, 0);
  assert.equal(res.stdout.trim(), "hello");
  assert.equal(res.timedOut, false);
});
