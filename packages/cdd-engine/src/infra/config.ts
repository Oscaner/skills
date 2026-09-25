// packages/cdd-engine/src/infra/config.ts — ConfigLoader class (Task 5 single-point config
// consumption D1.5 ⑤; Task 7 OOP restructure 判定标准② — the four loaders are instance methods,
// zero bare function exports): engine-config.json = the single runtime-config file
// (context-contract + failure-categories + handoff-namespace merged into sections of one file).
// This module is the plane's ONLY loader — consumers read via an instance's four methods; no
// second `readFileSync(...engine-config…)` exists anywhere in the engine. The three legacy JSON
// files are deleted (config.test asserts zero residue); deleting a canonical file surfaces any
// unmigrated reference (mechanical constraint, not review formality).
// Module-load-time single read (same semantics as the pre-Task-7 load-time reads) — section
// accessors share one object reference; no second read point across instances.
// Resolve the package root by marker walk instead of a hardcoded '..' hop: real builds bundle
// everything into dist/cli.mjs where `../../templates/…` from the bundle lands one level too high
// (packages/templates/… — pre-existing consumer-install break, fixed by P2 T1 ④). The walk resolves
// <pkg>/templates/engine-config.json in both file states (dev stub src tree and the consumer bundle).
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(
  readFileSync(path.join(resolvePackageRoot(__dirname), "templates", "engine-config.json"), "utf8"),
) as EngineConfig;

/** ConfigLoader — the engine-config.json read single point. Construction is free (the canonical
 *  file resolves via the state-independent package-root walk); the four section accessors share
 *  the single parsed object. */
export class ConfigLoader {
  engineConfig(): EngineConfig {
    return CONFIG;
  }

  contextContract(): EngineConfig["contextContract"] {
    return CONFIG.contextContract;
  }

  failureCategories(): EngineConfig["failureCategories"] {
    return CONFIG.failureCategories;
  }

  handoffNamespace(): EngineConfig["handoffNamespace"] {
    return CONFIG.handoffNamespace;
  }
}
