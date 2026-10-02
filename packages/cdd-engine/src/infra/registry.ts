// packages/cdd-engine/src/infra/registry.ts — Registry class (TS port of registry.mjs + Task 7 OOP
// restructure Criterion ②: the CDD harness-contract domain rules — ship gate + the derived op×type prefix/suffix
// injection + CLI PATH preflight + cache profile — are instance methods, zero bare function exports).
// Same behavior contract as the .mjs module (checked by registry.test.mjs); this is the
// rebuilt-layer dependency point. The only env read here is the canonical whitelisted PATH key
// (channel audit ②) — see cliInPath.
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CddExitError } from "./exit.ts";
import { resolveResource } from "./resource.ts";

/** The shipped harness-contract file (harness rows + op×type prefix/suffix injection + ship gate).
 * State-independent resolution via the logical-name locator (C7 — the single path truth, dev tree
 * and dist pack tree isomorphic): the published copy at <pkg>/dist/config/harness-contract.json
 * (build.config.ts copy entry — the consumer install's face) first, the source config/ as the dev
 * fallback. */
export function resolveRegistryPath(
  fromDir = path.dirname(fileURLToPath(import.meta.url)),
): string {
  return resolveResource("harness-contract", fromDir);
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

/** Registry — the harness-contract domain rules (Criterion ②): reading a row, the derived op×type prefix
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

  // C8 — the dispatch prefix is DERIVED from the harness contract, never row data: the dispatch
  // table maps each op×type slot to a ref key (implement/fix → mattpocock-skills:tdd, review
  // task/branch → mattpocock-skills:code-review) or a harness-agnostic literal (review spec/plan →
  // the URC wording); the refs table renders the per-harness reference form (claude/cursor
  // `/namespace:skill`, pi `/skill:<bare>` — the pi-correct derivation that fixes the legacy
  // hand-written pi prefix).
  #renderRef(reg: any, ref: string, harness: string): string {
    return (reg?.refs?.[ref]?.[harness] as string | undefined) ?? "";
  }

  #renderSlot(reg: any, slot: unknown, harness: string): string {
    if (typeof slot === "string") {
      // A ref-shaped slot (`pkg:skill`) renders its per-harness ref form; a non-ref-shaped
      // literal (the URC wording) is harness-agnostic and passes through.
      if (/^[a-z][a-z-]*:[a-z][a-z-]*$/.test(slot)) {
        return this.#renderRef(reg, slot, harness);
      }
      return slot;
    }
    if (slot && typeof slot === "object") {
      const ref = (slot as { ref?: string; note?: string }).ref;
      if (typeof ref !== "string") return "";
      const base = this.#renderRef(reg, ref, harness);
      const note = (slot as { note?: string }).note;
      return note ? `${base} — ${note}` : base;
    }
    return "";
  }

  /** Derive the op×type prefix map for one harness (the shape resolveInjection reads; the same
   *  derivation checkHarness stamps on the returned entry). */
  derivePrefixMap(reg: any, harness: string): Record<string, unknown> {
    const dispatch = reg?.dispatch ?? {};
    const review = dispatch.review ?? {};
    const render = (op: string, type?: string): string => {
      const slot = type != null ? (review as Record<string, unknown>)[type] : dispatch[op];
      return this.#renderSlot(reg, slot, harness);
    };
    return {
      implement: render("implement"),
      review: {
        task: render("review", "task"),
        branch: render("review", "branch"),
        spec: render("review", "spec"),
        plan: render("review", "plan"),
      },
      fix: render("fix"),
    };
  }

  /** Derive one op×type injection string (the testable/guard face of the prefix derivation). */
  deriveInjection(reg: any, harness: string, op: string, type?: string): string {
    const map = this.derivePrefixMap(reg, harness) as Record<string, unknown>;
    const v = map[op] ?? "";
    // Shape-narrowed slot read: the op value is either the flat injection string or the typed
    // op×type map (the derivePrefixMap shape) — the object arm is verified by the typeof guard,
    // then read through the record index (the single cast at the shape boundary); a non-string
    // slot degrades to "" (the injection slots are strings by construction).
    if (v && typeof v === "object") {
      const slot = type != null ? (v as Record<string, unknown>)[type] : undefined;
      return typeof slot === "string" ? slot : "";
    }
    return typeof v === "string" ? v : "";
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
    // C8 — the prefix data is deleted; the dispatch prefix is derived from the contract's dispatch
    // + refs tables and stamped on the returned entry (resolveInjection reads it from `prefix`,
    // the consumers' signature unchanged).
    return { ...entry, prefix: this.derivePrefixMap(reg, harness) };
  }

  // ---- spec D-3 C7: per-harness cache profile (capability as data) ----
  // The `cache` profile rides the registry row (mechanism / minTokens / readMultiplier /
  // writeMultiplier / ttlMinutes / observable), validated against config/schema/
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
