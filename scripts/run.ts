#!/usr/bin/env node
// scripts/run.ts — the repo automation entry: the single orchestrator face over the
// emit + validate + precommit + smoke surfaces. The thin wrapper modules fold here:
// `emit` writes the product set into the repo root, `emit-check`/`validate`/`precommit`
// run the composed validate runner (its step set is the data table; precommit is the
// tree-independent subset), `smoke-cdd` boots the new-tree bin over a fixture repo.
// This file is the composition root — the orchestrators' declared entry, executable
// directly or consumed by tests.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { emitComparer, emitService, REPO_ROOT } from "./emit.ts";
import { smokeCdd } from "./smoke-cdd.ts";
import { precommitSteps, steps, validateRunner } from "./validate.ts";

async function main(): Promise<void> {
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
    case "validate": {
      process.exitCode = await validateRunner.run(steps);
      return;
    }
    case "precommit": {
      process.exitCode = await validateRunner.run(precommitSteps);
      return;
    }
    case "smoke-cdd": {
      smokeCdd.run();
      console.log("OK — smoke-cdd dry-run chain green (new-tree bin)");
      return;
    }
    default:
      process.stderr.write("usage: run <emit|emit-check|validate|precommit|smoke-cdd>\n");
      process.exitCode = 2;
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
