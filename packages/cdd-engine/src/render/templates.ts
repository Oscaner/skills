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

// ---- template-contract (Task 5 D1.5 ⑤ 单点消费): 渲染数据面单文件 ----
// template-contract.json = skeleton{sections,segments{static,variant},order} + tokens(18) +
// clauses(容器,条款本体 T12 入库) + reviews(4 族内容配置)。templates.ts 是本平面唯一加载点。
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

// template name → relative path (templatePath 的唯一来源; 旧 MODE_GROUPS 组映射退役).
// task/             task family — cdd implement/fix 子命令 (templates/task/{implement,fix}.md)
// docs/             docs family — 共享 review 壳 (docs/review.md) + docs fix 壳 (docs/fix.md)
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
//     escaping would corrupt the H1 four-line contract (`status: <APPROVED|BLOCKED>`),
//     HANDOFF_WRITE_GATE (`> ⚠️ …`) and schema/brief injections. The schema injection /
//     H1 four-line / brief values therefore ALL travel through `{{{X}}}`.
//   · strict: true makes any missing (undefined) param throw — exactly the legacy "missing param"
//     guard; handlebars' `"KEY" not defined in …` message is normalized back to the pinned wording.
export const HANDOFF_SCHEMA_JSON_SLOT = "{{HANDOFF_SCHEMA_JSON}}";

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
      HANDOFF_SCHEMA_JSON: HANDOFF_SCHEMA_JSON_SLOT,
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
// { schema, return } — the unique source of the RETURN_FORMAT template param: returnMode → canonical
// "return" ("h1"/"json"). handoffType retires entirely (Task 5: HANDOFF/HANDOFF_TYPE merge into
// HANDOFF_TARGET — the injected schema bytes self-describe; the "(schema family: X)" parenthetical
// is dropped). fixTemplate is not surfaced by this layer (runFix reads the fix family directly; no
// second read point).
export function reviewArtifactConfig(type: string): { schema: string; return: string } {
  const cfg = familyConfig("review", type) as unknown as { schema: string; return: string };
  return { schema: cfg.schema, return: cfg.return };
}

// returnFormat=h1 types (task/branch) inject the four-line H1 contract into {{RETURN_STDOUT_BLOCK}};
// spec/plan render nothing (empty). Task 18: this block sits inside the shared `## Return` shell (no
// longer carries its own `## Return (H1 — stdout only)` heading — the template Return section
// headings are unified, and a duplicate heading would break the "4 templates same skeleton"
// section-order assertion). Task 5: H1_BLOCK → RETURN_STDOUT_BLOCK (命名规范: 域_语义).
export const RETURN_STDOUT_BLOCK = `Return **exactly 4 lines** to stdout; make this block the **final** output — nothing may follow it (stream-json harnesses parse the last block):

\`\`\`
status: <APPROVED|BLOCKED>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
\`\`\``;

// review.md HANDOFF_WRITE_GATE (T6; Task 5 renaming HARD_GATE → HANDOFF_WRITE_GATE): returnFormat
// split-writes — h1 → "BEFORE outputting H1"; json → "BEFORE outputting the JSON return". Injects
// the actual handoff path. Illicit returnFormat → h1 default (unknown families must not crash
// rendering).
export function reviewHardGate(returnFormat: string, handoffPath?: unknown): string {
  const before = returnFormat === "json" ? "BEFORE outputting the JSON return." : "BEFORE outputting H1.";
  const target = handoffPath ?? "{{HANDOFF_TARGET}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` ${before}\n> Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// docs-family fix (cdd fix --type spec|plan) HANDOFF_WRITE_GATE (Task 18 review-1 finding 2):
// fix's return IS the on-disk write (docs/fix.md `## Return` says "Your return IS the handoff
// written to … — the engine reads the file, not your stdout"; no JSON return on stdout). Must not
// reuse reviewHardGate("json") — "BEFORE outputting the JSON return" would self-contradict for a
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

// ---- token registry (Task 5 D1.4) — template-contract.json#tokens 驱动/校验 ----
// 18 令牌全收敛到新命名规范 (域_语义 + task-*/docs-* 作用域前缀): 旧态名 (H1_BLOCK / HANDOFF 三义 /
// HANDOFF_STUB / HANDOFF_TYPE / TYPE / LENS_GUIDE / AXES / HARD_GATE / RETURN_MODE / WORKSPACE /
// REFERENCE / PLAN_LINE / FINDINGS / BRIEF / TASK / CONSTRAINTS / FIXED_POINT / DOC) 零遗留 ——
// 校验器对任何非 registry 令牌直接 throw。

/** 提取模板声明文本里的全部 `{{TOKEN}}` 令牌。 */
export function scanTemplateTokens(src: string): string[] {
  return [...src.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]);
}

/** 断言模板只使用 registry 令牌（未知/旧态名 → throw）。 */
export function validateTemplateTokens(src: string, contract: TemplateContract = loadTemplateContract()): void {
  for (const tok of scanTemplateTokens(src)) {
    if (!contract.tokens.includes(tok)) throw new Error(`template token not in registry: ${tok}`);
  }
}

// variant (Return) 段专属令牌: cache 两段制的 variant 区 = Return 段; 这些令牌不得出现在
// static 段 (title/context/instructions/handoff) —— 骨架数据驱动的 C1 字节不变量。
const VARIANT_TOKENS = Object.freeze(["RETURN_STDOUT_BLOCK", "RETURN_FORMAT"]);

/** 骨架校验: `## ` 章顺序 === skeleton.sections, variant 令牌只许在 ## Return 段内。 */
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

/** 4 模板逐一对骨架数据校验 (章序/段归属/令牌 registry) — 一致性违例 → 抛; 通过 → 返回文件清单。 */
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
      RETURN_FORMAT: art.return,
      RETURN_STDOUT_BLOCK: RETURN_STDOUT_BLOCK,
      REVIEW_PLAN_LINE: params.REVIEW_PLAN_LINE ?? "",
      HANDOFF_WRITE_GATE: reviewHardGate(art.return, params.HANDOFF_TARGET),
    });
    // HANDOFF_SCHEMA_JSON: shared-shell slot = schema verbatim injection (Task 18, zero render; no
    // values injection surface).
    const stub = renderHandoffSchemaJson(loadHandoffSchema("task"));
    return prompt.replace(HANDOFF_SCHEMA_JSON_SLOT, stub);
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
  // Shared Handoff / Return shell slots (task family = implement/fix): HANDOFF_WRITE_GATE per mode
  // (fix = write-before-return; implement = no handoff, runner materializes), RETURN_STDOUT_BLOCK =
  // the shared four-line contract — both travel through {{{X}}} with the schema injection (raw, no
  // escaping). HANDOFF_SCHEMA_JSON keeps the literal slot for the per-caller schema replace.
  return compile(tripleAll(content), { strict: true })({
    ...filledParams,
    HANDOFF_WRITE_GATE: mode === "fix" ? reviewHardGate("h1", params.HANDOFF_TARGET) : implementHardGate(params.HANDOFF_TARGET, params.TASK_NUMBER),
    RETURN_STDOUT_BLOCK: RETURN_STDOUT_BLOCK,
    HANDOFF_SCHEMA_JSON: HANDOFF_SCHEMA_JSON_SLOT,
  }).replace(HANDOFF_SCHEMA_JSON_SLOT, renderHandoffSchemaJson(loadHandoffSchema("task")));
}

export function renderTemplate(name: string, params: Record<string, unknown>, programName?: string): string {
  const templatePath_ = templatePath(name);
  if (!existsSync(templatePath_)) {
    throw new Error(`${programName}: template not found: ${templatePath_}`);
  }
  return renderWithHandlebars(readFileSync(templatePath_, "utf8"), params, programName, name);
}
