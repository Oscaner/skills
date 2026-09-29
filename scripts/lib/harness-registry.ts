// scripts/lib/harness-registry.ts — the per-harness domain abstraction (pi-harness-p2 C1).
// One Harness per distribution target (claude / cursor / pi). Each harness owns surfaces
// that were previously hardcoded per-plugin in the emit toolchain: its manifest document
// builder, its source.json descriptor contribution, and its package-surface validation
// contract. The registry provides the fixed iteration order (the source.json row key-slot
// order) and the bidirectional wiring guard against `pkg.oscaner.harnesses` declarations.
//
// Single source of truth: the harness classes ARE the manifest builders — the emit side
// (scripts/emit/plugin-manifests.ts) consumes Harness.manifest directly, and no competing
// builder survives in manifests.ts. The byte pins (harness-registry.test.ts) guard them
// against the committed per-package .claude-plugin / .cursor-plugin products and the
// derived marketplace/source.json row. The pi package contract (P1 five assertions,
// scripts/validate/osuperpowers.ts) is folded in unchanged, with the count and pkgRoot
// injected via ctx (this lib never imports the validate side).

import { existsSync } from "node:fs";
import { join } from "node:path";

/** Emit-generated file watermark carried by every product document. */
const GENERATED = "scripts/run.ts emit — do not edit";

export abstract class Harness {
  /** Harness identity — the registry id and the source.json row key slot. */
  abstract readonly id: "claude" | "cursor" | "pi";
  /** Emitted file product relative to contentRoot; `undefined` = inline distribution. */
  abstract readonly product: { rel: string } | undefined;

  /** Build this harness's manifest document for a plugin source row + version. */
  abstract manifest(plugin, version: string): object;
  /** source.json descriptor contribution for a plugin's oscaner; `undefined` = no row slot. */
  abstract sourceJson(osc): object | undefined;
  /** Package-surface contract; default no-op — claude/cursor carry no package assertions. */
  validatePackage(_pkg, _ctx): void {
    // no-op: only PiHarness overrides with its five-assertion guard.
  }
}

export class CursorHarness extends Harness {
  readonly id = "cursor" as const;
  readonly product = { rel: ".cursor-plugin/plugin.json" };

  /** `.cursor-plugin/plugin.json` — thin manifest, no per-harness skill copy. */
  manifest(plugin, version) {
    const m = {
      _generated: GENERATED,
      name: plugin.name,
      displayName: plugin.cursor?.displayName ?? plugin.name,
      description: plugin.description,
      version,
      author: plugin.author,
    };
    if (plugin.license) m.license = plugin.license;
    const kw = keywordsOf(plugin);
    if (kw.length) m.keywords = kw;
    m.skills = "./skills/";
    return m;
  }

  /** First-party plugins ship plugin-root cursor manifests — the emit-mode descriptor. */
  sourceJson(_osc) {
    return { emitMode: "plugin-root" };
  }
}

export class ClaudeHarness extends Harness {
  readonly id = "claude" as const;
  readonly product = { rel: ".claude-plugin/plugin.json" };

  /**
   * `.claude-plugin/plugin.json` — Claude Code manifest. Thin: skills/ points at
   * the canonical dir. `noSkills` omits the `skills` field for the overrides
   * trigger router, which ships no skill bodies (osuperpowers keeps
   * `skills: "./skills/"`).
   */
  manifest(plugin, version, { noSkills = false } = {}) {
    const m = {
      _generated: GENERATED,
      name: plugin.name,
      description: plugin.description,
      version,
      author: plugin.author,
    };
    if (!noSkills) m.skills = "./skills/";
    // Claude Code auto-loads <pluginRoot>/hooks/hooks.json as the standard hooks
    // file, so manifest.hooks may only name *additional* hook files — referencing
    // the canonical file makes plugin load fail with "Duplicate hooks file
    // detected". The canonical default is therefore omitted; a non-default
    // `oscaner.hooks.claude` (an extra hook file) is still emitted.
    const claudeHooks = plugin.hooks?.claude ?? "./hooks/hooks.json";
    if (claudeHooks !== "./hooks/hooks.json") m.hooks = claudeHooks;
    if (plugin.license) m.license = plugin.license;
    if (plugin.claude?.category) m.category = plugin.claude.category;
    const kw = keywordsOf(plugin);
    if (kw.length) m.keywords = kw;
    return m;
  }

  /**
   * Claude descriptor contribution. Packages without an `oscaner.claude`
   * field contribute nothing (undefined is skipped by the row-assembly loop, so
   * they never land a `claude: {}` slot — the same absence the `if (osc.claude
   * !== undefined)` gate preserved). Keywords aggregate top-level
   * `oscaner.keywords` first, then `claude.keywords` — the single D7
   * byte-stable reconciliation point between the two keyword sources.
   */
  sourceJson(osc) {
    if (osc.claude === undefined) return undefined;
    return { ...osc.claude, keywords: osc.keywords ?? osc.claude?.keywords };
  }
}

export class PiHarness extends Harness {
  readonly id = "pi" as const;
  readonly product = undefined;

  /** Unreachable — pi is an inline distribution and ships no manifest document. */
  manifest(_plugin, _version) {
    throw new Error("PiHarness produces no manifest — pi is an inline distribution");
  }

  /** Pi contributes no source.json row slot — it is not part of the emit aggregate. */
  sourceJson(_osc) {
    return undefined;
  }

  /**
   * Package-surface contract for the pi harness — the folded P1 five assertions:
   * `pi-package` keyword literal / non-empty `./<path>` pi.skills glob shapes /
   * no extensions+prompts keys / each glob resolves `expectedCount` SKILL.md dirs /
   * files-closure static subset (strip `./` and `/` prefix coverage). The disk
   * baseline (pkgRoot) and the skills count are injected via ctx so the lib never
   * imports the validate side (count single-truth = scripts/validate/osuperpowers.ts).
   */
  validatePackage(pkg, ctx) {
    const declared = pkg.pi?.skills;

    // 1. Keywords carry the pi-package marker.
    if (!(Array.isArray(pkg.keywords) && pkg.keywords.includes("pi-package"))) {
      throw new Error("package keywords must contain the literal pi-package");
    }

    // 2. pi.skills is a non-empty string[] of ./<path> glob shapes.
    if (!Array.isArray(declared) || declared.length === 0) {
      throw new Error("pi.skills must be a non-empty array");
    }
    for (const s of declared) {
      if (typeof s !== "string" || !s.startsWith("./") || s.length <= 2 || s.includes("..")) {
        throw new Error(`pi.skills entries must be ./<path> glob shapes, got: ${s}`);
      }
    }

    // 3. pi declares no extensions/prompts keys (R0 invariant).
    for (const key of ["extensions", "prompts"]) {
      if (Object.hasOwn(pkg.pi ?? {}, key)) throw new Error(`pi must not declare an ${key} key`);
    }

    // 4. Each declared skills path resolves to exactly expectedCount SKILL.md dirs.
    for (const s of declared) {
      const dir = join(ctx.pkgRoot, s.replace(/^\.\//, "").replace(/\/\*$/, ""));
      if (!existsSync(dir)) throw new Error(`pi.skills path must resolve on disk: ${s}`);
      const n = ctx.countSkills(dir);
      if (n !== ctx.expectedCount) {
        throw new Error(`expected ${ctx.expectedCount} skills under ${s}, got ${n}`);
      }
    }

    // 5. Files closure: each pi-declared path is a static subset of the pkg.files
    //    whitelist (directory or file prefix coverage after stripping ./ and /).
    const whitelist = (pkg.files ?? []).map((p) => p.replace(/\/$/, ""));
    for (const s of declared) {
      const d = s.replace(/^\.\//, "");
      const covered = whitelist.some((w) => d === w || d.startsWith(`${w}/`));
      if (!covered) {
        throw new Error(`pi-declared path ${d} must be covered by a package files whitelist entry`);
      }
    }
  }
}

export class HarnessRegistry {
  #byId: Map<string, Harness>;
  #all: readonly Harness[];

  constructor(harnesses: Harness[]) {
    this.#all = [...harnesses];
    this.#byId = new Map(harnesses.map((h) => [h.id, h]));
  }

  /** Fixed iteration order — the source.json row key-slot order (cursor, claude, pi). */
  all(): readonly Harness[] {
    return this.#all;
  }

  /** Resolve a harness by id; unknown ids throw with the id (and package when given). */
  resolve(id: string, packageName?: string): Harness {
    const harness = this.#byId.get(id);
    if (harness === undefined) {
      const suffix = packageName === undefined ? "" : ` for package ${packageName}`;
      throw new Error(`Unknown harness id "${id}"${suffix}`);
    }
    return harness;
  }

  /**
   * Bidirectional wiring guard against `pkg.oscaner.harnesses` declarations: every
   * registry row must be declared by at least one package (a registered-but-unwired
   * harness is a defect), and every declared id must exist in the registry (a
   * declared-but-unknown id is a defect). Both directions report the offending id.
   */
  assertBidirectional(declarations) {
    const declared = new Set(Object.values(declarations).flat());
    for (const harness of this.#all) {
      if (!declared.has(harness.id)) {
        throw new Error(`Harness "${harness.id}" is registered but declared by no package`);
      }
    }
    for (const [packageName, ids] of Object.entries(declarations)) {
      for (const id of ids) {
        if (!this.#byId.has(id)) {
          throw new Error(`Package "${packageName}" declares unknown harness id "${id}"`);
        }
      }
    }
  }
}

export const cursorHarness = new CursorHarness();
export const claudeHarness = new ClaudeHarness();
export const piHarness = new PiHarness();

/** The repo's harness registry singleton — the single access point for emit + validate. */
export const harnessRegistry = new HarnessRegistry([cursorHarness, claudeHarness, piHarness]);

/** Shared keyword source for both thin manifests (claude keywords, tags fallback). */
function keywordsOf(plugin) {
  return plugin.claude?.keywords ?? plugin.claude?.tags ?? [];
}
