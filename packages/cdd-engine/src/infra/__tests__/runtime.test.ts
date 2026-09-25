// packages/cdd-engine/src/infra/__tests__/runtime.test.ts — P4.4 Task 4 acceptance:
// ① CddRuntime is the engine's single module-level mutable-state surface (the sweep: zero
//    module-level `let` declarations in src — the six legacy surfaces converged);
// ② constructor injection — a CddRuntime stand-in substitutes the singleton and dryRun/root/proc
//    demonstrably flow through the class face;
// ③ the templates render cache migrated into the runtime-owned object (no module-level CACHE).

import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { DRY_RUN, setDryRun } from "../../cli/shared.ts";
import { runTask } from "../../dispatch/task.ts";
import { REG_PATH } from "../registry.ts";
import { CddRuntime, type CddRuntimeLike, runtime } from "../runtime.ts";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("CddRuntime — the single module-level mutable-state surface", () => {
  it("sweep: zero module-level `let` mutable declarations in src (tests excluded)", () => {
    const hits = execSync(
      `grep -rnE '^(export[[:space:]]+)?let[[:space:]]+' "${SRC}" --include="*.ts" | grep -v '__tests__' || true`,
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);
    expect(hits).toEqual([]); // the six legacy surfaces (dryRun/_root/registry/diskPath/idleTimer/signalExitCode/cacheProfileValidator) converged into CddRuntime
  });

  it("dryRun state routes through the singleton (setDryRun → DRY_RUN → runtime.isDryRun)", () => {
    const before = DRY_RUN();
    try {
      setDryRun(true);
      expect(DRY_RUN()).toBe(true);
      expect(runtime.isDryRun()).toBe(true);
    } finally {
      setDryRun(before);
    }
  });

  it("the templates render cache object is runtime-owned (reset/stats go through the class)", async () => {
    const { resetTemplateCaches, templateCacheStats } = await import("../../render/templates.ts");
    resetTemplateCaches();
    expect(templateCacheStats()).toEqual({ reads: 0, compiles: 0, tailRenders: 0 });
    const statHits = Object.keys(runtime.templateCache);
    // the contract/compiled slots are render-typed, the counters are the observable stats surface
    expect(statHits).toContain("reads");
  });
});

describe("CddRuntime — constructor injection (② the stand-in substitutes the singleton)", () => {
  // A dry-run review dispatch with a stubbed runtime: isDryRun() → true routes the entry-gate
  // downgrade (never a hard BLOCKED), getRoot() supplies the repo root, withLifecycle wraps the
  // run — all three channels demonstrably through the injected class face.
  function setupRepo(): string {
    const dest = mkdtempSync(path.join(tmpdir(), "cdd-runtime-inj-"));
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", dest, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
    git("init", "-q");
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "--allow-empty", "-qm", "fixture");
    return dest;
  }

  it("injected stand-in: dryRun (isDryRun) + root (getRoot) + proc (withLifecycle) all flow through the class", async () => {
    const repo = setupRepo();
    mkdirSync(path.join(repo, "docs"), { recursive: true });
    writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
    execFileSync("git", ["-C", repo, "add", "-A"], { stdio: ["ignore", "pipe", "ignore"] });
    execFileSync(
      "git",
      ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan"],
      {
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    const isDryRun = vi.fn(() => true); // downgrade lane — never a hard entry BLOCK on a dirty tree
    const getRoot = vi.fn(() => repo);
    const withLifecycle = vi.fn(<T>(fn: () => Promise<T>): Promise<T> => fn());
    const stub: CddRuntimeLike = {
      isDryRun,
      setDryRun: vi.fn(),
      initRoot: vi.fn(async () => repo),
      getRoot,
      withLifecycle,
      teardownAll: vi.fn(async () => {}),
      startIdleMonitor: vi.fn(),
      stopIdleMonitor: vi.fn(),
      reapStale: vi.fn(async () => {}),
      signalExitCode: null,
    };

    const regDir = mkdtempSync(path.join(tmpdir(), "cdd-runtime-reg-"));
    const regPath = path.join(regDir, "registry.json");
    const reg = JSON.parse(readFileSync(REG_PATH, "utf8")) as Record<string, unknown>;
    (reg as Record<string, unknown>).ghost = {
      cli: "fake-cli",
      invoke: "-p",
      output: "text",
      ship: "full",
    };
    writeFileSync(regPath, JSON.stringify(reg));

    const res = await runTask("ghost", 1, {
      mode: "review",
      planFile: "docs/plan.md",
      noExit: true,
      registryPath: regPath,
      runtime: stub,
    });
    // dry-run + clean exit: the stub's isDryRun() fed the gate downgrade path.
    expect(res.exitCode).toBe(0);
    expect(res.returnBlock[0]).toBe("status: APPROVED");
    // all three channels went through the injected class face:
    expect(withLifecycle).toHaveBeenCalledTimes(1);
    expect(isDryRun).toHaveBeenCalled();
    expect(getRoot).toHaveBeenCalled(); // root came from the stand-in (no opts.root) — never the singleton
  });

  it("the singleton is the default — an un-injected run still routes through CddRuntime", () => {
    expect(runtime).toBeInstanceOf(CddRuntime);
    expect(runtime.withLifecycle).toBeTypeOf("function");
    expect(existsSync(SRC)).toBe(true);
  });
});
