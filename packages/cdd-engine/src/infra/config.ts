// packages/cdd-engine/src/infra/config.ts — Task 5 single-point config consumption (D1.5 ⑤):
// engine-config.json = the single runtime-config file (context-contract + failure-categories +
// handoff-namespace merged into sections of one file). This module is the plane's ONLY loader —
// consumers read via loadEngineConfig / section accessors; no second
// `readFileSync(...engine-config…)` exists anywhere in the engine. The three legacy JSON files
// are deleted (config.test asserts zero residue); deleting a canonical file surfaces any
// unmigrated reference (mechanical constraint, not review formality).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePackageRoot } from "./resource.ts";

export interface EngineConfig {
  contextContract: Record<string, any>;
  failureCategories: { categories: Array<Record<string, any>> };
  handoffNamespace: {
    workspaceRoot: string;
    families: Record<string, Record<string, any>>;
  };
}

// Module-load-time single read (same semantics as the load-time reads in context.ts /
// failure.ts / naming.ts) — section accessors share one object reference; no second read point.
// Resolve the package root by marker walk instead of a hardcoded '..' hop: real builds bundle
// everything into dist/cli.mjs where `../../templates/…` from the bundle lands one level too high
// (packages/templates/… — pre-existing consumer-install break, fixed by P2 T1 ④). The walk resolves
// <pkg>/templates/engine-config.json in both file states (dev stub src tree and the consumer bundle).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(
  readFileSync(path.join(resolvePackageRoot(__dirname), "templates", "engine-config.json"), "utf8"),
) as EngineConfig;

export function loadEngineConfig(): EngineConfig {
  return CONFIG;
}

export function loadContextContract(): EngineConfig["contextContract"] {
  return CONFIG.contextContract;
}

export function loadFailureCategories(): EngineConfig["failureCategories"] {
  return CONFIG.failureCategories;
}

export function loadHandoffNamespace(): EngineConfig["handoffNamespace"] {
  return CONFIG.handoffNamespace;
}
