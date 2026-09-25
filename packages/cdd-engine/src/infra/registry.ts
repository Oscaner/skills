// packages/cdd-engine/src/infra/registry.ts — Registry class (TS port of registry.mjs + Task 7 OOP
// restructure 判定标准②: the CDD harness-registry domain rules — ship gate + op×type prefix/suffix
// injection + CLI PATH preflight + cache profile — are instance methods, zero bare function exports).
// Same behavior contract as the .mjs module (checked by registry.test.mjs); this is the
// rebuilt-layer dependency point. The only env read here is the canonical whitelisted PATH key
// (channel audit ②) — see cliInPath.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CddExitError } from "./exit.ts";
import { resolvePackageRoot } from "./resource.ts";

/** The shipped harness-registry file (harness rows + op×type prefix/suffix injection + ship gate).
 * State-independent resolution (same convention as documents/schema.ts resolveDocSchemaDir): the
 * published copy at <pkg>/dist/resources/harness-registry.json (build.config.ts copy entry — the
 * consumer install's face; the module-origin relative `new URL` would resolve into the bundle's
 * chunk dir, which no build materializes) first, the src tree as the dev fallback. */
export function resolveRegistryPath(
  fromDir = path.dirname(fileURLToPath(import.meta.url)),
): string {
  const root = resolvePackageRoot(fromDir);
  const published = path.join(root, "dist", "resources", "harness-registry.json");
  if (existsSync(published)) return published;
  return path.join(root, "src", "infra", "harness-registry.json");
}

export const REG_PATH = resolveRegistryPath();

// Registry gate blockage — the CddExitError family (P6 T24 F): exitCode + kind fields, bin.ts's
// top-level catch unifies the family by kind; `instanceof CddBlockedError` keeps working for the
// dispatch runners' local catch (task/branch surfaces degrade to their run-blocked exit).
export class CddBlockedError extends CddExitError {
  constructor(
    message: string,
    { exitCode = 1, kind = "blocked" }: { exitCode?: number; kind?: string } = {},
  ) {
    super(message, { exitCode, kind });
    this.name = "CddBlockedError";
  }
}

/** Registry — the harness-registry domain rules (判定标准②): reading a row, op×type prefix/suffix
 *  injection resolution, the CLI PATH preflight, the ship gate and the cache-profile read are all
 *  instance methods. Stateless; construction is cheap. */
export class Registry {
  /** Parse the shipped registry JSON (regPath default = the canonical REG_PATH). */
  load(regPath: string): any {
    return JSON.parse(readFileSync(regPath, "utf8"));
  }

  field(reg: any, harness: string, field: string): string {
    const entry = reg?.[harness];
    if (!entry) return "";
    return entry[field] ?? "";
  }

  #resolveInjectionField(entry: any, field: string, op: string, type?: string): string {
    const v = entry?.[field]?.[op] ?? "";
    if (v && typeof v === "object") return type ? (v[type] ?? "") : "";
    return typeof v === "string" ? v : "";
  }

  resolveInjection(entry: any, op: string, type?: string): string {
    return this.#resolveInjectionField(entry, "prefix", op, type);
  }

  resolveSuffix(entry: any, op: string, type?: string): string {
    return this.#resolveInjectionField(entry, "suffix", op, type);
  }

  cliInPath(cli: string): boolean {
    const pathDirs = (process.env.PATH ?? "").split(path.delimiter);
    for (const dir of pathDirs) {
      if (!dir) continue;
      try {
        const st = statSync(path.join(dir, cli));
        if (st.isFile() && (st.mode & 0o111) !== 0) return true;
      } catch {
        // dir has no such binary — keep scanning
      }
    }
    return false;
  }

  checkHarness(reg: any, harness: string, opts: { dryRun?: boolean } = {}): any {
    const { dryRun = false } = opts ?? {};
    const entry = reg?.[harness];
    if (!entry) throw new CddBlockedError(`unknown harness: ${harness}`, { exitCode: 1 });
    if (entry.ship !== "full")
      throw new CddBlockedError(`harness not supported: ${harness}`, { exitCode: 1 });
    const cli = entry.cli;
    if (!cli) throw new CddBlockedError(`unknown harness: ${harness}`, { exitCode: 1 });
    if (!dryRun && !this.cliInPath(cli)) {
      throw new CddBlockedError(`${cli} not found in PATH`, { exitCode: 2, kind: "cli-missing" });
    }
    return entry;
  }

  // ---- spec D-3 C7: per-harness cache profile (capability as data) ----
  // The `cache` profile rides the registry row (mechanism / minTokens / readMultiplier /
  // writeMultiplier / ttlMinutes / observable), validated against templates/schema/
  // cache-profile-schema.json — adding a harness = one registry row, contract unchanged.
  cacheProfileFor(entry: any): unknown {
    return entry?.cache ?? null;
  }
}

// Lazy ajv validator over the canonical cache-profile schema (same pattern as rules/schema.ts).
// Not called on the dispatch hot path — exercised by tests/validate against the shipped registry.
// P4.4 Task 4: the former module-level `let cacheProfileValidator` memo migrated into the
// CddRuntime singleton (infra/runtime.ts — the class is the single mutable-state surface); this
// module re-exports the same identity so registry consumers keep importing the canonical face.
export { validateCacheProfile } from "./runtime.ts";
