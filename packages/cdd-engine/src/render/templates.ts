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

// template name → group mapping (URC: review template data-driven — the six legacy review/fix
// templates are deleted; the shared shell review.md + fix/docs.md are driven by canonical config;
// Task 18: doc-fix.md → fix/docs.md moved out of review/).
// task/             cdd renders per mode (implement/fix subcommands consume)
// review/           review shared shell (cdd review --type task|branch|spec|plan)
// fix/              docs-family fix shell (cdd fix --type spec|plan — canonical fix.{type}.fixTemplate = "docs")
// schema/           handoff JSON schemas (task-handoff-schema.json / docs-handoff-schema.json)
const MODE_GROUPS: Record<string, string> = {
  implement: "task",
  fix: "task",
  review: "review",
  docs: "fix",
};

// template name → absolute path (group-aware). Unknown template name → throws.
export function templatePath(name: string): string {
  const group = MODE_GROUPS[name];
  if (!group) throw new Error(`unknown template: ${name}`);
  return path.join(PKG_ROOT, group, `${name}.md`);
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

// ---- Handoff contract injection (Task 18: schema verbatim) ----
// Contract uniqueness (schema) → injection uniqueness (its string form). Zero render: to interpret,
// simplify, pre-fill, shrink the skeleton or write enum examples — the rules are all carried by the
// schema's description (the write-protocol rules moved into semantics: status "write findings not
// status" / findings "{lens,severity,…}" / artifacts "point at files" / commits.head "40-char full
// form" / blocker "omit when no blocker").
export function renderHandoffStub(schema: unknown): string {
  return '```json\n' + JSON.stringify(schema) + '\n```';
}

// ---- shared-shell rendering (handlebars, byte-identical to the legacy split/join) ----
// Template files keep the legacy `{{X}}` double-stash spelling (templates.content.test pins the
// file literals). Rendering normalizes the content ONCE per render:
//   · `{{HANDOFF_STUB}}` is resolved by a dedicated param carrying the literal slot text itself:
//     `HANDOFF_STUB: "{{HANDOFF_STUB}}"`. The triple-stash (`{{{HANDOFF_STUB}}}`) emits it raw, so
//     the rendered output keeps the literal slot — callers inject per-caller schemas AFTER render by
//     re-replacing it (docs.ts "docs", task.ts / branch-review / renderModePrompt "task"), exactly
//     like the legacy split/join pipeline. (A control-byte sentinel was tried first, but handlebars'
//     lexer rejects it — "Lexical error" at first template use; the slot-text param needs none.)
//   · every remaining `{{X}}` → `{{{X}}}` triple-stash: strict compile with raw (un-escaped)
//     values — the legacy split/join injected params verbatim, and handlebars' default HTML
//     escaping would corrupt the H1 four-line contract (`status: <APPROVED|BLOCKED>`), HARD_GATE
//     (`> ⚠️ …`) and schema/brief injections. The schema injection / H1 four-line / brief values
//     therefore ALL travel through `{{{X}}}`.
//   · strict: true makes any missing (undefined) param throw — exactly the legacy "missing param"
//     guard; handlebars' `"KEY" not defined in …` message is normalized back to the pinned wording.
const HANDOFF_STUB_SLOT = "{{HANDOFF_STUB}}";

function tripleAll(src: string): string {
  return src.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m: string, key: string) => `{{{${key}}}}`);
}

function renderWithHandlebars(
  content: string,
  params: Record<string, unknown>,
  programName: string | undefined,
  templateNameForError: string,
): string {
  try {
    return compile(tripleAll(content), { strict: true })({
      ...params,
      HANDOFF_STUB: HANDOFF_STUB_SLOT,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const missing = msg.match(/^"([^"]+)" not defined/);
    if (missing) {
      throw new Error(`${programName}: template ${templateNameForError}: missing param ${missing[1]}`);
    }
    throw err;
  }
}

// ---- Review template data-driven (reviews.json per-type config + review.md shared shell) ----

export function loadReviews(): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(PKG_ROOT, "review", "reviews.json"), "utf8")) as Record<string, unknown>;
}

export interface ReviewTypeConfig {
  lensEnum: string[];
  ref: string;
  axesGuide: string;
}

// reviews.json[type] → pure content contract { lensEnum, ref, axesGuide } (T2 axis cut:
// returnMode/handoffType/fixTemplate moved to canonical; artifact reads go through
// reviewArtifactConfig). task/branch refs are git-range symbols (TASK_BASE..HEAD / BASE..HEAD,
// concrete-injected by the caller); spec/plan refs are relational descriptions (doc vs spec), the
// actual doc path lands on REFERENCE via the caller.
export function reviewTypeConfig(type: string): ReviewTypeConfig {
  const cfg = loadReviews()[type] as ReviewTypeConfig | undefined;
  if (!cfg) throw new Error(`unknown review type: ${type}`);
  return cfg;
}

// reviewArtifactConfig(type) → reads the canonical handoff-namespace.json review.{type} family,
// returns { schema, return } — the unique source of HANDOFF_TYPE / RETURN_MODE template params:
// the handoffType field name retires → canonical's schema ("task"/"docs"), returnMode → canonical's
// return ("h1"/"json"). fixTemplate is not surfaced by this layer (runFix reads the fix family
// directly; no second read point). Task 18: schema prefix unified — canonical values renamed with
// the file cdd- → task-.
export function reviewArtifactConfig(type: string): { schema: string; return: string } {
  const cfg = familyConfig("review", type) as unknown as { schema: string; return: string };
  return { schema: cfg.schema, return: cfg.return };
}

// returnMode=h1 types (task/branch) inject the four-line H1 contract into {{H1_BLOCK}}; spec/plan
// render nothing (empty). Task 18: this block sits inside the shared `## Return` shell (no longer
// carries its own `## Return (H1 — stdout only)` heading — the template Return section headings are
// unified, and a duplicate heading would break the "4 templates same skeleton" section-order
// assertion).
export const REVIEW_H1_BLOCK = `Return **exactly 4 lines** to stdout; make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

\`\`\`
status: <APPROVED|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
\`\`\``;

// review.md HARD GATE (T6): returnMode split-writes — h1 → "BEFORE outputting H1"; json → "BEFORE
// outputting the JSON return". Injects the actual handoff path. Illicit returnMode → h1 default
// (unknown families must not crash rendering).
export function reviewHardGate(returnMode: string, handoffPath?: unknown): string {
  const before = returnMode === "json" ? "BEFORE outputting the JSON return." : "BEFORE outputting H1.";
  const target = handoffPath ?? "{{HANDOFF}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` ${before}\n> Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// docs-family fix (cdd fix --type spec|plan) HARD GATE (Task 18 review-1 finding 2): fix's return
// IS the on-disk write (fix/docs.md `## Return` says "Your return IS the handoff written to … — the
// engine reads the file, not your stdout"; no JSON return on stdout). Must not reuse
// reviewHardGate("json") — "BEFORE outputting the JSON return" would self-contradict for a fix
// agent. Gate semantics = exit only after the write.
export function docsFixHardGate(handoffPath?: unknown): string {
  const target = handoffPath ?? "{{HANDOFF}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` BEFORE exiting: the engine reads the file, not your stdout. Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// implement's HARD GATE: this mode does not write a handoff (the runner materializes it from the
// H1 four lines + TASK_BASE + git HEAD), isomorphic to fix/review's "write-before-return" but
// semantically inverted — the shared-Handoff-shell slot's injected value, not a template
// difference. Artifacts (report + test evidence) come first: the materialized handoff's artifacts
// all come from them; absent → BLOCKED.
function implementHardGate(handoffPath: unknown, taskNum: unknown): string {
  const target = handoffPath || `task-${taskNum}-implement.json`;
  return `> ⚠️ HARD GATE — This mode does not write \`${target}\`: the runner materializes it from your H1 four lines + the brief's \`TASK_BASE\` + \`git HEAD\`. Write the implementer report + test evidence BEFORE outputting H1 — returning without them = BLOCKED (runner exit 1).`;
}

// params = promptParams (produced by buildPromptParams): template interpolation keys + PLAN_LINE.
// PLAN_LINE comes from the caller deriving it off the **explicit plan path** and passing it via
// params — this layer reads zero env, and never introduces an env key named after a plan path
// (that key name is the hit surface of the "derived values must not ride the env" guard).
export function renderModePrompt(mode: string, params: Record<string, unknown> = {}): string {
  // review mode routes through the review.md shared shell (reviews.json type=task config); the old
  // assembled template is deleted. REFERENCE concrete-izes as FIXED_POINT..HEAD. fix/implement stay
  // on the task/ templates.
  if (mode === "review") {
    const cfg = reviewTypeConfig("task");
    const art = reviewArtifactConfig("task");
    let prompt = renderTemplate("review", {
      TYPE: "task",
      WORKSPACE: params.WORKSPACE ?? "",
      LENS_GUIDE: cfg.lensEnum.join(" · "),
      REFERENCE: params.FIXED_POINT ? `${params.FIXED_POINT}..HEAD` : cfg.ref,
      AXES: cfg.axesGuide,
      HANDOFF: params.HANDOFF ?? "",
      HANDOFF_TYPE: art.schema,
      RETURN_MODE: art.return,
      H1_BLOCK: REVIEW_H1_BLOCK,
      PLAN_LINE: params.PLAN_LINE ?? "",
      HARD_GATE: reviewHardGate(art.return, params.HANDOFF),
    });
    // HANDOFF_STUB: shared-shell slot = schema verbatim injection (Task 18, zero render; no
    // values injection surface).
    const stub = renderHandoffStub(loadHandoffSchema("task"));
    return prompt.replace(/\{\{HANDOFF_STUB\}\}/g, stub);
  }
  const modePath = templatePath(mode);
  if (!existsSync(modePath)) throw new Error(`missing template: ${modePath}`);
  const content = readFileSync(modePath, "utf8");
  // Non-review modes never fatally reject missing params — the legacy PLACEHOLDERS split/join
  // defaulted a missing key to "" (implement/fix mode = "" injection); strict resolution would
  // throw, so pre-fill every placeholder the file declares with `params[key] ?? ""`.
  const filledParams: Record<string, unknown> = {};
  for (const key of new Set<string>([...content.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]))) {
    filledParams[key] = params[key] ?? "";
  }
  // Shared Handoff / Return shell slots (task family = implement/fix): HARD_GATE per mode
  // (fix = write-before-return; implement = no handoff, runner materializes), H1_BLOCK = the
  // shared four-line contract — both travel through {{{X}}} with the schema injection (raw, no
  // escaping). HANDOFF_STUB keeps the literal slot for the per-caller schema replace.
  return compile(tripleAll(content), { strict: true })({
    ...filledParams,
    HARD_GATE: mode === "fix" ? reviewHardGate("h1", params.HANDOFF) : implementHardGate(params.HANDOFF, params.TASK),
    H1_BLOCK: REVIEW_H1_BLOCK,
    HANDOFF_STUB: HANDOFF_STUB_SLOT,
  }).replace(/\{\{HANDOFF_STUB\}\}/g, renderHandoffStub(loadHandoffSchema("task")));
}

export function renderTemplate(name: string, params: Record<string, unknown>, programName?: string): string {
  const templatePath_ = templatePath(name);
  if (!existsSync(templatePath_)) {
    throw new Error(`${programName}: template not found: ${templatePath_}`);
  }
  return renderWithHandlebars(readFileSync(templatePath_, "utf8"), params, programName, name);
}