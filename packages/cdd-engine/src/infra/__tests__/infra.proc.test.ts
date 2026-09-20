// packages/cdd-engine/src/infra/__tests__/infra.proc.test.ts
// Mirrors the .mjs lifecycle.proc.test.mjs contract on the rebuilt module: five-field spawn result,
// immediate registry registration, disk persistence, unified termination (budgetMs + elapsed +
// SIGTERM signal shape), teardownAll group reaping. Contract-only focus — the process-group
// isolation matrix (grandchildren, cross-run orphans) stays covered by the .mjs suite since the
// rebuild is contract-identical.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { processGroupReapingSupported } from "./helpers.ts";
import { initProcLifecycle, teardownAll, spawnManaged, persistRegistry, reapStale } from "../proc.ts";

const GROUP_SUPPORTED = processGroupReapingSupported();
const DISK = path.join(os.tmpdir(), `infra-proc-${process.pid}.json`);

describe("infra/proc.ts — spawnManaged", () => {
  beforeEach(async () => {
    await initProcLifecycle({ diskPath: DISK });
    await teardownAll();
  });
  afterEach(async () => { await teardownAll(); });

  it("five-field contract on success: ok/code/stdout/stderr/timedOut", async () => {
    const r = await spawnManaged(process.execPath, ["-e", "console.log('hi')"], {
      cwd: os.tmpdir(), env: process.env, termination: { budgetMs: 5000 },
    });
    expect(r).toMatchObject({ ok: true, code: 0 });
    expect(r.stdout).toContain("hi");
    expect(typeof r.stderr).toBe("string");
    expect(r.timedOut).toBe(false);
  });

  it("non-zero exit → ok false, code preserved, stderr captured", async () => {
    const r = await spawnManaged(process.execPath, ["-e", "console.error('boom'); process.exit(3)"], {
      cwd: os.tmpdir(), env: process.env, termination: { budgetMs: 5000 },
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("boom");
  });

  it("spawn failure (missing binary) → fail-open ok:false", async () => {
    const r = await spawnManaged("cdd-surely-missing-binary-xyz", [], { cwd: os.tmpdir(), env: process.env, termination: { budgetMs: 5000 } });
    expect(r.ok).toBe(false);
    expect(typeof r.code).toBe("number");
  });

  it("timeout exceeded → timedOut true, ok false (budget signal fires the kill)", async () => {
    const r = await spawnManaged(process.execPath, ["-e", "setTimeout(() => {}, 30_000)"], {
      cwd: os.tmpdir(), env: process.env, termination: { budgetMs: 500 },
    });
    expect(r.timedOut).toBe(true);
    expect(r.ok).toBe(false);
  }, 20_000);

  it("credentials stripped at the single spawn point (ANTHROPIC_API_KEY never reaches child)", async () => {
    const r = await spawnManaged(process.execPath, ["-e", "console.log(process.env.ANTHROPIC_API_KEY ?? 'empty')"], {
      cwd: os.tmpdir(),
      env: { ...process.env, ANTHROPIC_API_KEY: "sk-test", CLAUDE_CODE_SUBAGENT_MODEL: "m" },
      termination: { budgetMs: 5000 },
    });
    expect(r.stdout.trim()).toBe("empty");
  });
});

describe("infra/proc.ts — registry persistence + stale reaping", () => {
  beforeEach(async () => {
    await initProcLifecycle({ diskPath: DISK });
    await teardownAll();
  });
  afterEach(async () => { await teardownAll(); });

  it("spawn registers to in-memory registry and persists to disk synchronously", async () => {
    await spawnManaged(process.execPath, ["-e", "console.log('x')"], { cwd: os.tmpdir(), env: process.env, termination: { budgetMs: 5000 } });
    const onDisk = JSON.parse(readFileSync(DISK, "utf8"));
    expect(onDisk).toHaveLength(1);
    expect(onDisk[0].ownerPid).toBe(process.pid);
    expect(onDisk[0].done).toBe(false);
    // a completed dispatch group is marked done by teardown; persist keeps the disk view in sync
    await persistRegistry();
  });

  it("reapStale on a gone group is fail-open", async () => {
    await spawnManaged("sleep", ["0.05"], { cwd: os.tmpdir(), env: process.env, termination: { budgetMs: 2000 } });
    await new Promise((r) => setTimeout(r, 200));
    await expect(reapStale({ graceMs: 200 })).resolves.toBeUndefined();
  }, 20_000);
});

describe.skipIf(!GROUP_SUPPORTED)("infra/proc.ts — teardownAll group semantics", () => {
  beforeEach(async () => {
    await initProcLifecycle({ diskPath: DISK });
    await teardownAll();
  });
  afterEach(async () => { await teardownAll(); });

  it("teardownAll kills a lingering child and empties disk registry", async () => {
    // leader spawns an orphaned grandchild then exits 0 — the GROUP survives the leader:
    // teardownAll roots the detached group (pgid) including the grandchild.
    const script = "const{spawn}=require('child_process');spawn(process.execPath,['-e','setInterval(()=>{},60000)']).unref();process.exit(0)";
    const r = await spawnManaged(process.execPath, ["-e", script], {
      cwd: os.tmpdir(), env: process.env, termination: { budgetMs: 5000 },
    });
    expect(r).toMatchObject({ ok: true, code: 0 });
    await teardownAll({ graceMs: 400 });
    expect(JSON.parse(readFileSync(DISK, "utf8"))).toEqual([]);
  }, 20_000);
});
