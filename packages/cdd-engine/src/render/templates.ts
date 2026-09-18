// packages/cdd-engine/src/render/templates.ts (ex lib/templates.mjs)
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// handlebars is CommonJS (no export map): Node ESM can only see `default` / `module.exports`,
// so the default-import + destructure form is the interop-safe spelling used everywhere (vitest
// and the plain-node validate chains both resolve `hb.compile` to the compile function).
import hb from "handlebars";

const compile = hb.compile;

import { loadHandoffSchema } from "../rules/schema.ts";
import { familyConfig } from "../artifacts/handoff/naming.ts";

// PKG_ROOT = <pkg>/templates (re-org Step 5): rewritten relative to import.meta.url as ../templates/,
// eliminating the path.resolve(__dirname, …) counting chain; semantics converge on this template
// resource dir itself (consumers stop appending a 'templates' segment).
export const PKG_ROOT = fileURLToPath(new URL("../../templates", import.meta.url));

// ---- template-contract (Task 5 D1.5 ⑤ single-point consumption): one file, the rendering data plane ----
// template-contract.json = skeleton{sections,segments{static,variant},order} + tokens(18) +
// clauses (container; clause bodies land in T12) + reviews (4-family content config). templates.ts
// is this plane's only loader.
export interface TemplateContract {
  skeleton: {
    sections: string[];
    segments: { static: string[]; variant: string[] };
    order: string[];
  };
  tokens: string[];
  clauses: Record<string, unknown>;
  reviews: Record<string, unknown>;
}

export function loadTemplateContract(): TemplateContract {
  return JSON.parse(
    readFileSync(path.join(PKG_ROOT, "template-contract.json"), "utf8"),
  ) as TemplateContract;
}

// template name → relative path (the only source of templatePath; legacy MODE_GROUPS map retired).
// task/             task family — cdd implement/fix subcommands (templates/task/{implement,fix}.md)
// docs/             docs family — shared review shell (docs/review.md) + docs fix shell (docs/fix.md)
// schema/           handoff JSON schemas (task-handoff-schema.json / docs-handoff-schema.json)
export const TEMPLATE_FILES: Record<string, string> = {
  implement: "task/implement.md",
  fix: "task/fix.md",
  review: "docs/review.md",
  docs: "docs/fix.md",
};

// template name → absolute path. Unknown template name → throws.
export function templatePath(name: string): string {
  const rel = TEMPLATE_FILES[name];
  if (!rel) throw new Error(`unknown template: ${name}`);
  return path.join(PKG_ROOT, rel);
}

export const LINE_BUDGETS = Object.freeze({
  sdd: 210, ctrl: 50, tier1: 260, tier2: 331,
});

export function lineBudget(tier: string): number {
  if (!(tier in LINE_BUDGETS)) throw new Error(`unknown line budget tier: ${tier}`);
  return LINE_BUDGETS[tier as keyof typeof LINE_BUDGETS];
}

// pluginRoot() removed — callers use the PKG_ROOT constant instead.
// Backward-compat: export an alias for callers that passed pluginRoot as DI.
// re-org Step 5: PKG_ROOT semantics = the template resource dir → pluginRoot() also returns it
// (run-task step 2.5 existence check targets pluginRootFn() directly, no longer appends 'templates').
export function pluginRoot(): string { return PKG_ROOT; }

// ---- Handoff contract injection (Task 18: schema verbatim; Task 5: HANDOFF_SCHEMA_JSON) ----
// Contract uniqueness (schema) → injection uniqueness (its string form). Zero render: to interpret,
// simplify, pre-fill, shrink the skeleton or write enum examples — the rules are all carried by the
// schema's description (the write-protocol rules moved into semantics: status "write findings not
// status" / findings "{lens,severity,…}" / artifacts "point at files" / commits.head "40-char full
// form" / blocker "omit when no blocker").
export function renderHandoffSchemaJson(schema: unknown): string {
  return '```json\n' + JSON.stringify(schema) + '\n```';
}

// ---- shared-shell rendering (handlebars, byte-identical to the legacy split/join) ----
// Template files keep the legacy `{{X}}` double-stash spelling (templates.content.test pins the
// file literals). Rendering normalizes the content ONCE per render:
//   · `{{HANDOFF_SCHEMA_JSON}}` is resolved by a dedicated param carrying the literal slot text
//     itself: `HANDOFF_SCHEMA_JSON: "{{HANDOFF_SCHEMA_JSON}}"`. The triple-stash
//     (`{{{HANDOFF_SCHEMA_JSON}}}`) emits it raw, so the rendered output keeps the literal slot —
//     callers inject per-caller schemas AFTER render by re-replacing it (docs.ts "docs",
//     task.ts / branch-review / renderModePrompt "task"), exactly like the legacy split/join
//     pipeline. (A control-byte sentinel was tried first, but handlebars' lexer rejects it —
//     "Lexical error" at first template use; the slot-text param needs none.)
//   · every remaining `{{X}}` → `{{{X}}}` triple-stash: strict compile with raw (un-escaped)
//     values — the legacy split/join injected params verbatim, and handlebars' default HTML
//     escaping would corrupt the four-line return contract (`status: <APPROVED|BLOCKED>`),
//     HANDOFF_WRITE_GATE (`> ⚠️ …`) and schema/brief injections. The schema injection /
//     H1 four-line / brief values therefore ALL travel through `{{{X}}}`.
//   · strict: true makes any missing (undefined) param throw — exactly the legacy "missing param"
//     guard; handlebars' `"KEY" not defined in …` message is normalized back to the pinned wording.
export const HANDOFF_SCHEMA_JSON_SLOT = "{{HANDOFF_SCHEMA_JSON}}";

function tripleAll(src: string): string {
  return src.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m: string, key: string) => `{{{${key}}}}`);
}

// ---- C4 cache-first render memoization (spec D-3 C4; module-level, one frozen artifact tree) ----
// Three frozen layers, all scoped at module level so one session's dispatches rebuild nothing:
//   ① template SOURCE bytes  → cached per template name (one file read per name per process);
//   ② handlebars COMPILED fn → cached per name per part (static zone / Return tail) — the "冻结编译产物";
//   ③ rendered STATIC ZONE   → cached per (template name, canonical static params) — re-dispatch of the
//     same (op,type) with identical params returns the frozen bytes, zero re-render.
// The static zone = the template bytes before `## Return` (skeleton segment ownership: static
// segments are title/context/instructions/handoff — the Return section is the variant payload that
// MUST re-render per dispatch). C5's dispatch-set constancy is what keeps the cache key stable
// across a task's rounds. templateCacheStats()/resetTemplateCaches() are the observable seams
// (the memoize assertion lives in templates.cache.test).
export const STATIC_REGION_MARKER = "## Return";

const CACHE = {
  source: new Map<string, string>(),
  compiledStatic: new Map<string, ReturnType<typeof compile>>(),
  compiledTail: new Map<string, ReturnType<typeof compile>>(),
  staticShell: new Map<string, string>(),
  reads: 0,
  compiles: 0,
  staticShellRenders: 0,
} as {
  source: Map<string, string>;
  compiledStatic: Map<string, ReturnType<typeof compile>>;
  compiledTail: Map<string, ReturnType<typeof compile>>;
  staticShell: Map<string, string>;
  reads: number;
  compiles: number;
  staticShellRenders: number;
};

export interface TemplateCacheStats {
  reads: number;
  compiles: number;
  staticShellRenders: number;
}

export function templateCacheStats(): TemplateCacheStats {
  return { reads: CACHE.reads, compiles: CACHE.compiles, staticShellRenders: CACHE.staticShellRenders };
}

export function resetTemplateCaches(): void {
  CACHE.source.clear();
  CACHE.compiledStatic.clear();
  CACHE.compiledTail.clear();
  CACHE.staticShell.clear();
  CACHE.reads = 0;
  CACHE.compiles = 0;
  CACHE.staticShellRenders = 0;
}

// Canonical, environment-independent cache key (C3: deterministic serialization — sorted keys,
// JSON-escaped values; insertion order never factors in). A re-dispatch with the same values in any
// key order lands on the same frozen static zone.
export function staticShellKey(name: string, params: Record<string, unknown>): string {
  const lines = Object.keys(params)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${JSON.stringify(params[k])}`);
  return `${name}\n${lines.join("\n")}`;
}

function cachedSource(name: string): string {
  let src = CACHE.source.get(name);
  if (src === undefined) {
    const p = templatePath(name);
    if (!existsSync(p)) throw new Error(`template not found: ${p}`);
    src = readFileSync(p, "utf8");
    CACHE.reads++;
    CACHE.source.set(name, src);
  }
  return src;
}

// strict compile + render a template part with the shared cache; keeps the pinned missing-param
// error wording (legacy renderWithHandlebars contract) and the HANDOFF_SCHEMA_JSON slot injection.
function renderPart(
  cacheMap: Map<string, ReturnType<typeof compile>>,
  name: string,
  src: string,
  params: Record<string, unknown>,
  programName: string | undefined,
): string {
  let fn = cacheMap.get(name);
  if (!fn) {
    fn = compile(tripleAll(src), { strict: true });
    CACHE.compiles++;
    cacheMap.set(name, fn);
  }
  try {
    return fn({ ...params, HANDOFF_SCHEMA_JSON: HANDOFF_SCHEMA_JSON_SLOT });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const missing = msg.match(/^"([^"]+)" not defined/);
    if (missing) {
      throw new Error(`${programName}: template ${name}: missing param ${missing[1]}`);
    }
    throw err;
  }
}

// ---- Review template data-driven (template-contract.json#reviews per-type config + shared shell) ----

export function loadReviews(): Record<string, unknown> {
  return loadTemplateContract().reviews;
}

export interface ReviewTypeConfig {
  lensEnum: string[];
  ref: string;
  axesGuide: string;
}

// #reviews[type] → pure content contract { lensEnum, ref, axesGuide } (T2 axis cut:
// returnFormat/handoffType/fixTemplate moved to canonical; artifact reads go through
// reviewArtifactConfig). task/branch refs are git-range symbols (REVIEW_REFERENCE ← concrete
// FIXED_POINT..HEAD / BASE..HEAD); spec/plan refs are relational descriptions (doc vs spec), the
// actual doc path lands on REVIEW_REFERENCE via the caller.
export function reviewTypeConfig(type: string): ReviewTypeConfig {
  const cfg = loadReviews()[type] as ReviewTypeConfig | undefined;
  if (!cfg) throw new Error(`unknown review type: ${type}`);
  return cfg;
}

// reviewArtifactConfig(type) → reads the canonical handoffNamespace review.{type} family, returns
// { schema, returnFormat } — the unique source of the RETURN_FORMAT template param; returnFormat ∈
// {"RETURN_STDOUT_BLOCK", "RETURN_JSON"} (the canonical return-contract discriminator; legacy "h1"
// vocabulary retired by Task 5 naming convergence). handoffType retires entirely (Task 5:
// HANDOFF/HANDOFF_TYPE merge into HANDOFF_TARGET — the injected schema bytes self-describe; the
// "(schema family: X)" parenthetical is dropped). fixTemplate is not surfaced by this layer (runFix
// reads the fix family directly; no second read point).
export function reviewArtifactConfig(type: string): { schema: string; returnFormat: string } {
  const cfg = familyConfig("review", type) as unknown as { schema: string; returnFormat: string };
  return { schema: cfg.schema, returnFormat: cfg.returnFormat };
}

// returnFormat=RETURN_STDOUT_BLOCK types (task/branch) inject the four-line return contract into {{RETURN_STDOUT_BLOCK}};
// spec/plan render nothing (empty). Task 18: this block sits inside the shared `## Return` shell (no
// longer carries its own `## Return (H1 — stdout only)` heading — the template Return section
// headings are unified, and a duplicate heading would break the "4 templates same skeleton"
// section-order assertion). Task 5: H1_BLOCK → RETURN_STDOUT_BLOCK (naming convention: <domain>_<semantic>).
export const RETURN_STDOUT_BLOCK = `Return **exactly 4 lines** to stdout; make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

\`\`\`
status: <APPROVED|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
\`\`\``;

// review.md HANDOFF_WRITE_GATE (T6; Task 5 renaming HARD_GATE → HANDOFF_WRITE_GATE): returnFormat
// split-writes — RETURN_STDOUT_BLOCK → "BEFORE outputting the RETURN_STDOUT_BLOCK"; RETURN_JSON →
// "BEFORE outputting the JSON return". Injects the actual handoff path. Illicit returnFormat →
// RETURN_STDOUT_BLOCK default (unknown families must not crash rendering).
export function reviewHardGate(returnFormat: string, handoffPath?: unknown): string {
  const before = returnFormat === "RETURN_JSON" ? "BEFORE outputting the JSON return." : "BEFORE outputting the RETURN_STDOUT_BLOCK.";
  const target = handoffPath ?? "{{HANDOFF_TARGET}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` ${before}\n> Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// docs-family fix (cdd fix --type spec|plan) HANDOFF_WRITE_GATE (Task 18 review-1 finding 2):
// fix's return IS the on-disk write (docs/fix.md `## Return` says "Your return IS the handoff
// written to … — the engine reads the file, not your stdout"; no JSON return on stdout). Must not
// reuse reviewHardGate("RETURN_JSON") — "BEFORE outputting the JSON return" would self-contradict for a
// fix agent. Gate semantics = exit only after the write.
export function docsFixHardGate(handoffPath?: unknown): string {
  const target = handoffPath ?? "{{HANDOFF_TARGET}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` BEFORE exiting: the engine reads the file, not your stdout. Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// implement's HANDOFF_WRITE_GATE: this mode does not write a handoff (the runner materializes it
// from the H1 four lines + TASK_BASE + git HEAD), isomorphic to fix/review's "write-before-return"
// but semantically inverted — the shared-Handoff-shell slot's injected value, not a template
// difference. Artifacts (report + test evidence) come first: the materialized handoff's artifacts
// all come from them; absent → BLOCKED.
function implementHardGate(handoffPath: unknown, taskNum: unknown): string {
  const target = handoffPath || `task-${taskNum}-implement.json`;
  return `> ⚠️ HARD GATE — This mode does not write \`${target}\`: the runner materializes it from your H1 four lines + the brief's \`TASK_BASE\` + \`git HEAD\`. Write the implementer report + test evidence BEFORE outputting H1 — returning without them = BLOCKED (runner exit 1).`;
}

// ---- token registry (Task 5 D1.4) — driven/validated by template-contract.json#tokens ----
// All 18 tokens converge to the new naming convention (<domain>_<semantic> + task-*/docs-* scope
// prefixes): zero legacy names remain (H1_BLOCK / HANDOFF triple-meaning / HANDOFF_STUB /
// HANDOFF_TYPE / TYPE / LENS_GUIDE / AXES / HARD_GATE / RETURN_MODE / WORKSPACE / REFERENCE /
// PLAN_LINE / FINDINGS / BRIEF / TASK / CONSTRAINTS / FIXED_POINT / DOC) — the validator throws
// for any token not in the registry.

/** Extract all `{{TOKEN}}` tokens declared in the template text. */
export function scanTemplateTokens(src: string): string[] {
  return [...src.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]);
}

/** Assert the template uses only registry tokens (unknown/legacy name → throw). */
export function validateTemplateTokens(src: string, contract: TemplateContract = loadTemplateContract()): void {
  for (const tok of scanTemplateTokens(src)) {
    if (!contract.tokens.includes(tok)) throw new Error(`template token not in registry: ${tok}`);
  }
}

// Variant (Return)-section-only tokens: the cache two-part regime's variant zone = the Return
// section; these tokens must not appear in static sections (title/context/instructions/handoff) —
// the skeleton-data-driven C1 byte invariant.
const VARIANT_TOKENS = Object.freeze(["RETURN_STDOUT_BLOCK", "RETURN_FORMAT"]);

/** Skeleton check: `## ` section order === skeleton.sections; variant tokens only inside ## Return. */
export function validateTemplateStructure(src: string, contract: TemplateContract = loadTemplateContract()): void {
  const secs = [...src.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  if (JSON.stringify(secs) !== JSON.stringify(contract.skeleton.sections)) {
    throw new Error(
      `template sections mismatch: got [${secs.join(", ")}], expected [${contract.skeleton.sections.join(", ")}]`,
    );
  }
  const returnIdx = src.indexOf("## Return");
  const staticPart = returnIdx < 0 ? src : src.slice(0, returnIdx);
  for (const tok of VARIANT_TOKENS) {
    if (staticPart.includes(`{{${tok}}}`)) {
      throw new Error(`variant token {{${tok}}} in static section`);
    }
  }
}

/** Validate all 4 templates against the skeleton data (section order / segment ownership / token
 * registry) — throws on consistency violations; returns the file list on pass. */
export function validateShippedTemplates(): string[] {
  const files = Object.values(TEMPLATE_FILES);
  const problems: string[] = [];
  for (const rel of files) {
    const src = readFileSync(path.join(PKG_ROOT, rel), "utf8");
    try {
      validateTemplateTokens(src);
      validateTemplateStructure(src);
    } catch (err) {
      problems.push(`${rel}: ${(err as Error).message}`);
    }
  }
  if (problems.length) {
    throw new Error(`template contract violations:\n${problems.join("\n")}`);
  }
  return files;
}

// params = promptParams (produced by buildPromptParams): template interpolation keys + REVIEW_PLAN_LINE.
// REVIEW_PLAN_LINE comes from the caller deriving it off the **explicit plan path** and passing it
// via params — this layer reads zero env, and never introduces an env key named after a plan path
// (that key name is the hit surface of the "derived values must not ride the env" guard).
export function renderModePrompt(mode: string, params: Record<string, unknown> = {}): string {
  // review mode routes through the docs/review.md shared shell (template-contract reviews type=task
  // config); the old assembled template is deleted. REFERENCE concrete-izes as FIXED_POINT..HEAD.
  // fix/implement stay on the task/ templates.
  if (mode === "review") {
    const cfg = reviewTypeConfig("task");
    const art = reviewArtifactConfig("task");
    let prompt = renderTemplate("review", {
      REVIEW_TYPE: "task",
      TASK_WORKSPACE: params.TASK_WORKSPACE ?? "",
      REVIEW_LENS_GUIDE: cfg.lensEnum.join(" · "),
      REVIEW_REFERENCE: params.TASK_FIXED_POINT ? `${params.TASK_FIXED_POINT}..HEAD` : cfg.ref,
      REVIEW_AXES: cfg.axesGuide,
      HANDOFF_TARGET: params.HANDOFF_TARGET ?? "",
      RETURN_FORMAT: art.returnFormat,
      RETURN_STDOUT_BLOCK: RETURN_STDOUT_BLOCK,
      REVIEW_PLAN_LINE: params.REVIEW_PLAN_LINE ?? "",
      HANDOFF_WRITE_GATE: reviewHardGate(art.returnFormat, params.HANDOFF_TARGET),
    });
    // HANDOFF_SCHEMA_JSON: shared-shell slot = schema verbatim injection (Task 18, zero render; no
    // values injection surface).
    const stub = renderHandoffSchemaJson(loadHandoffSchema("task"));
    return prompt.replace(HANDOFF_SCHEMA_JSON_SLOT, stub);
  }
  const modePath = templatePath(mode);
  if (!existsSync(modePath)) throw new Error(`missing template: ${modePath}`);
  // Content read rides the C4 source cache (the existence check above stays first — an absent
  // template must throw before any caching; cachedSource re-checks and would throw the same).
  const content = cachedSource(mode);
  // Non-review modes never fatally reject missing params — the legacy PLACEHOLDERS split/join
  // defaulted a missing key to "" (implement/fix mode = "" injection); strict resolution would
  // throw, so pre-fill every placeholder the file declares with `params[key] ?? ""`.
  const filledParams: Record<string, unknown> = {};
  for (const key of new Set<string>([...content.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]))) {
    filledParams[key] = params[key] ?? "";
  }
  // Shared Handoff / Return shell slots (task family = implement/fix): HANDOFF_WRITE_GATE per mode
  // (fix = write-before-return; implement = no handoff, runner materializes), RETURN_STDOUT_BLOCK =
  // the shared four-line contract — both travel through {{{X}}} with the schema injection (raw, no
  // escaping). renderTemplate memoizes the static zone by (op,type,params) — C4 byte reuse; the
  // HANDOFF_SCHEMA_JSON slot (literal in the message) stays for the per-caller schema replace below.
  const prompt = renderTemplate(mode, {
    ...filledParams,
    HANDOFF_WRITE_GATE: mode === "fix" ? reviewHardGate("RETURN_STDOUT_BLOCK", params.HANDOFF_TARGET) : implementHardGate(params.HANDOFF_TARGET, params.TASK_NUMBER),
    RETURN_STDOUT_BLOCK: RETURN_STDOUT_BLOCK,
  });
  return prompt.replace(HANDOFF_SCHEMA_JSON_SLOT, renderHandoffSchemaJson(loadHandoffSchema("task")));
}

export function renderTemplate(name: string, params: Record<string, unknown>, programName?: string): string {
  const src = cachedSource(name);
  // C1 two-part assembly: the static zone (title/context/instructions/handoff) is memoized and
  // frozen; the variant payload (## Return tail) re-renders per dispatch. Splitting at the `## `
  // heading is section-safe — handlebars has no cross-section constructs, so rendering the two
  // halves independently is byte-identical to rendering the whole file.
  const retIdx = src.indexOf(STATIC_REGION_MARKER);
  const staticSrc = retIdx < 0 ? src : src.slice(0, retIdx);
  const tailSrc = retIdx < 0 ? "" : src.slice(retIdx);
  const key = staticShellKey(name, params);
  let shell = CACHE.staticShell.get(key);
  if (shell === undefined) {
    shell = renderPart(CACHE.compiledStatic, name, staticSrc, params, programName);
    CACHE.staticShellRenders++;
    CACHE.staticShell.set(key, shell);
  }
  if (!tailSrc) return shell;
  return shell + renderPart(CACHE.compiledTail, name, tailSrc, params, programName);
}
