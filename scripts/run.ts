#!/usr/bin/env node
// scripts/run.ts — the repo automation entry: the emit surfaces. `emit` writes the
// product set into the repo root, `emit-check` byte-compares it against the committed
// products. The validate orchestrator is dissolved (P5 — every check lives in its owning
// package suite; the native per-suite CI sequence succeeds it) and the cdd smoke moved
// into the engine test plane (its release gate runs `pnpm -C packages/cdd-engine run
// smoke`). This file is the composition root — the orchestrators' declared entry,
// executable directly or consumed by tests.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { emitComparer, emitService, REPO_ROOT } from "./emit.ts";

// biome-ignore lint/complexity/noStaticOnlyClass: the composition root's entry face — the main dispatch is a static member (zero-bare-function discipline).
export class RunCli {
  static async main(): Promise<void> {
    const verb = process.argv[2];
    switch (verb) {
      case "emit": {
        const generatedPaths: string[] = [];
        emitService.emitAll(REPO_ROOT, { generatedPaths });
        console.log(`OK — emitted ${generatedPaths.length} first-party manifests`);
        return;
      }
      case "emit-check": {
        const generatedPaths: string[] = [];
        const temp = mkdtempSync(path.join(tmpdir(), "scripts-emit-check-"));
        try {
          emitService.emitAll(temp, { generatedPaths });
          emitComparer.compareTrees(REPO_ROOT, temp, { generatedPaths });
          console.log("OK — emit fresh");
        } finally {
          rmSync(temp, { recursive: true, force: true });
        }
        return;
      }
      default:
        process.stderr.write("usage: run <emit|emit-check>\n");
        process.exitCode = 2;
    }
  }
}

RunCli.main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
