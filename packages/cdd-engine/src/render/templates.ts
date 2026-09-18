// packages/cdd-engine/src/render/templates.ts — Task 20 C1-max 字节布局层（spec D-3）。
// Single renderer + runtime assembly over template-contract.json#sections — the four template .md
// files merged into the contract's zone storage (渲染数据平面单文件), zero handwritten templates:
//   sections.shell      → one literal-constant shell (full shared frame；壳内零注入槽)
//   sections.return     → byte-constant `## Return` per return format
//   sections.round-context → the ONLY dynamic zone (absolute end；一切 per-dispatch 实值)
// Segment order is fixed: 壳 → ## Return → ## Round context. The shell is a process-level
// parameterless constant (C4: compiled once, reused forever; the per-dispatch shell cache key is
// eliminated) —
// renderTemplate renders only the Round-context tail (per dispatch params) on top of the frozen
// shell + return bytes. renderModePrompt / docs.ts / branch-review.ts are consumers of this
// single renderer (templatePath / TEMPLATE_FILES retired — no template files remain).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// handlebars is CommonJS (no export map): Node ESM can only see `default` / `module.exports`,
// so the default-import + destructure form is the interop-safe spelling used everywhere (vitest
// and the plain-node validate chains both resolve hb.compile to the compile function).
import hb from "handlebars";

const compile = hb.compile;

import { loadHandoffSchema } from "../rules/schema.ts";
import { familyConfig } from "../artifacts/handoff/naming.ts";

// PKG_ROOT = <pkg>/templates — the render data plane's resource dir (contract + schemas alone;
// re-org Step 5 semantics converged here; consumers use the constant directly).
export const PKG_ROOT = fileURLToPath(new URL("../../templates", import.meta.url));

// ---- template-contract (the rendering data plane): skeleton + zone sections + zone-tagged
// token registry + clauses container (T12) + reviews content config. templates.ts is this
// plane's only loader / assembler (config.ts reads engine-config.json separately). ----
export interface TemplateZoneToken {
  name: string;
  /** 壳禁槽: zone ∈ { return, round-context } — never "shell" (the shell embeds zero slots). */
  zone: string;
}

export interface TemplateContract {
  "$version": number;
  skeleton: {
    sections: string[];
    segments: Record<string, string[]>;
    order: string[];
  };
  sections: {
    shell: string[];
    return: Record<string, string[]>;
    "round-context": string[];
  };
  tokens: TemplateZoneToken[];
  clauses: Record<string, unknown>;
  reviews: Record<string, unknown>;
}

// ---- C4 cache-first layer (module-level, one frozen artifact tree per process) ----
// Three frozen layers, all scoped at module level so one session's dispatches rebuild nothing:
//   ① the CONTRACT source bytes   → parsed once (CACHE.reads);
//   ② the COMPILED round-context fn → compiled once (CACHE.compiles);
//   ③ the rendered ROUND CONTEXT  → memoized per canonical params — a re-dispatch with identical
//     params returns the frozen tail, zero re-render (CACHE.tailRenders counts distinct
//     tails materialized; the shell/return bytes are constants keyed only by family/format).
const CONTRACT_REL = "template-contract.json";

const CACHE: {
  contract: TemplateContract | null;
  shells: Map<string, string>;
  returns: Map<string, string>;
  compiledRound: ReturnType<typeof compile> | null;
  roundTokens: string[];
  rounds: Map<string, string>;
  reads: number;
  compiles: number;
  tailRenders: number;
} = {
  contract: null,
  shells: new Map(),
  returns: new Map(),
  compiledRound: null,
  roundTokens: [],
  rounds: new Map(),
  reads: 0,
  compiles: 0,
  tailRenders: 0,
};

export interface TemplateCacheStats {
  reads: number;
  compiles: number;
  tailRenders: number;
}

export function templateCacheStats(): TemplateCacheStats {
  return { reads: CACHE.reads, compiles: CACHE.compiles, tailRenders: CACHE.tailRenders };
}

export function resetTemplateCaches(): void {
  CACHE.contract = null;
  CACHE.shells.clear();
  CACHE.returns.clear();
  CACHE.compiledRound = null;
  CACHE.roundTokens = [];
  CACHE.rounds.clear();
  CACHE.reads = 0;
  CACHE.compiles = 0;
  CACHE.tailRenders = 0;
}

export function loadTemplateContract(): TemplateContract {
  if (!CACHE.contract) {
    CACHE.contract = JSON.parse(
      readFileSync(path.join(PKG_ROOT, CONTRACT_REL), "utf8"),
    ) as TemplateContract;
    CACHE.reads++;
    // T12 衔接面：partial 装配随合同缓存一次完成（幂等；空容器即 no-op）——任何 render 路径在
    // renderRoundContext 编译前必然先 loadTemplateContract，注册的 {{> clause}} 引用必可 resolve。
    assembleClauses(CACHE.contract);
  }
  return CACHE.contract;
}

export const LINE_BUDGETS = Object.freeze({
  sdd: 210, ctrl: 50, tier1: 260, tier2: 331,
});

export function lineBudget(tier: string): number {
  if (!(tier in LINE_BUDGETS)) throw new Error(`unknown line budget tier: ${tier}`);
  return LINE_BUDGETS[tier as keyof typeof LINE_BUDGETS];
}

// pluginRoot() = the template resource dir (PKG_ROOT) — run-task step 2.5 existence check targets
// pluginRootFn() directly (the dir holds the contract + schemas).
export function pluginRoot(): string { return PKG_ROOT; }

// ---- Handoff contract injection (Task 18: schema verbatim; zero render) ----
// Contract uniqueness (schema) → injection uniqueness (its string form). The schema is the only
// per-family injection the shell carries: shellFor(family) = shared frame + this block.
export function renderHandoffSchemaJson(schema: unknown): string {
  return '```json\n' + JSON.stringify(schema) + '\n```';
}

// ---- zone builders (runtime assembly; all memoized / frozen) ----

function joinLines(lines: string[]): string {
  return lines.join("\n") + "\n";
}

/** Registry token names in registry order. */
export function tokenNames(contract: TemplateContract = loadTemplateContract()): string[] {
  return contract.tokens.map((t) => t.name);
}

/** zone → its tokens (registry 归属：槽仅现所属区). */
export function tokensInZone(zone: string, contract: TemplateContract = loadTemplateContract()): string[] {
  return contract.tokens.filter((t) => t.zone === zone).map((t) => t.name);
}

/** family → the frozen shell = shared frame + the family's schema block (frames end with the
 * "per the schema below" prose; the schema block is the only injected bytes). */
function shellFor(family: string): string {
  let shell = CACHE.shells.get(family);
  if (shell === undefined) {
    const frame = joinLines(loadTemplateContract().sections.shell);
    const block = renderHandoffSchemaJson(loadHandoffSchema(family));
    shell = frame + "\n" + block;
    CACHE.shells.set(family, shell);
  }
  return shell;
}

/** return format → the frozen `## Return` constant. */
function returnFor(format: string): string {
  let out = CACHE.returns.get(format);
  if (out === undefined) {
    const lines = loadTemplateContract().sections.return[format];
    if (!lines) throw new Error(`unknown return format: ${format}`);
    out = joinLines(lines);
    CACHE.returns.set(format, out);
  }
  return out;
}

// returnFormat → shell family: the docs family owns RETURN_JSON (spec/plan review) and DOCS_FIX
// (spec/plan fix); everything else (RETURN_STDOUT_BLOCK / absent) is the task family. No
// switch-statement — a const discriminator map (residue guard: templates.ts is switch-free, and
// writing the forbidden token's literal shape here trips the guard's own scan).
const DOCS_FORMATS = Object.freeze(["RETURN_JSON", "DOCS_FIX"]);

function familyFor(returnFormat: unknown): string {
  return typeof returnFormat === "string" && DOCS_FORMATS.includes(returnFormat) ? "docs" : "task";
}

function defaultReturnFormat(): string {
  return "RETURN_STDOUT_BLOCK";
}

// Legacy double-stash → triple-stash (raw, un-escaped values): strict compile with {{{X}}}
// preserves the four-line contract (`status: <APPROVED|BLOCKED>`), the gate (`> ⚠️ …`) and path
// values verbatim.
function tripleAll(src: string): string {
  return src.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m: string, key: string) => `{{{${key}}}}`);
}

// Canonical, environment-independent memo key for the Round-context tail (sorted keys, JSON-escaped
// values; insertion order never factors in). The former exported shell cache-key helper is
// eliminated — the shell is keyed by family constant; this internal key memoizes the tail only.
function canonicalKey(params: Record<string, unknown>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${JSON.stringify(params[k])}`)
    .join("\n");
}

/** Render the Round-context tail (the ONLY dynamic zone) — compile once, memoize per canonical
 * params, pre-fill absent round slots with "" (mode-union template: strictness is impossible
 * across modes; the legacy missing-param throw retires with the per-template files). */
function renderRoundContext(
  name: string,
  params: Record<string, unknown>,
  programName: string | undefined,
): string {
  const roundSrc = joinLines(loadTemplateContract().sections["round-context"]);
  if (!CACHE.compiledRound) {
    CACHE.compiledRound = compile(tripleAll(roundSrc), { strict: true });
    CACHE.compiles++;
    CACHE.roundTokens = scanTemplateTokens(roundSrc);
  }
  const filled: Record<string, unknown> = {};
  for (const key of CACHE.roundTokens) filled[key] = params[key] ?? "";
  const key = canonicalKey(filled);
  let out = CACHE.rounds.get(key);
  if (out === undefined) {
    try {
      out = CACHE.compiledRound(filled);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const missing = msg.match(/^"([^"]+)" not defined/);
      if (missing) {
        throw new Error(`${programName}: template ${name}: missing param ${missing[1]}`);
      }
      throw err;
    }
    CACHE.tailRenders++;
    CACHE.rounds.set(key, out);
  }
  return out;
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
// {"RETURN_STDOUT_BLOCK", "RETURN_JSON"} (the canonical return-contract discriminator). fixTemplate
// is not surfaced by this layer (runFix reads the fix family directly; no second read point).
export function reviewArtifactConfig(type: string): { schema: string; returnFormat: string } {
  const cfg = familyConfig("review", type) as unknown as { schema: string; returnFormat: string };
  return { schema: cfg.schema, returnFormat: cfg.returnFormat };
}

// review.md HANDOFF_WRITE_GATE (T6; HARD_GATE → HANDOFF_WRITE_GATE naming): returnFormat
// split-writes — RETURN_STDOUT_BLOCK → "BEFORE outputting the RETURN_STDOUT_BLOCK"; RETURN_JSON →
// "BEFORE outputting the JSON return". Task 20: the gate VALUE (real handoff path) rides the
// Round-context `### HANDOFF_WRITE_GATE` slot — the shell prose is byte constant. Illicit
// returnFormat → RETURN_STDOUT_BLOCK default (unknown families must not crash rendering).
export function reviewHardGate(returnFormat: string, handoffPath?: unknown): string {
  const before = returnFormat === "RETURN_JSON" ? "BEFORE outputting the JSON return." : "BEFORE outputting the RETURN_STDOUT_BLOCK.";
  const target = handoffPath ?? "{{HANDOFF_TARGET}}";
  return `> ⚠️ HARD GATE — Write \`${target}\` ${before}\n> Returning without a written handoff file = BLOCKED (runner exit 1).`;
}

// docs-family fix (cdd fix --type spec|plan) HANDOFF_WRITE_GATE (Task 18 review-1 finding 2):
// fix's return IS the on-disk write (the DOCS_FIX return constant says "the engine reads the
// file, not your stdout"; no JSON return on stdout). Must not reuse reviewHardGate("RETURN_JSON")
// — "BEFORE outputting the JSON return" would self-contradict for a fix agent. Gate semantics =
// exit only after the write.
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

// ---- token registry (Task 5 D1.4 + Task 20 zones) — driven/validated by template-contract.json ----
// 19 tokens converge to the new naming convention (<domain>_<semantic> + task-*/docs-* scope
// prefixes) and carry a zone 归属 (return | round-context; 壳零槽 — no token may live in
// "shell"). Zero legacy names remain (H1_BLOCK / HANDOFF triple-meaning / HANDOFF_STUB /
// HANDOFF_TYPE / HANDOFF_SCHEMA_JSON / TYPE / LENS_GUIDE / AXES / HARD_GATE / RETURN_MODE /
// WORKSPACE / REFERENCE / PLAN_LINE / FINDINGS / BRIEF / TASK / CONSTRAINTS / FIXED_POINT / DOC).

/** Extract all `{{TOKEN}}` tokens declared in the text. */
export function scanTemplateTokens(src: string): string[] {
  return [...src.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]);
}

/** Assert the text uses only registry tokens (unknown/legacy name → throw). */
export function validateTemplateTokens(src: string, contract: TemplateContract = loadTemplateContract()): void {
  const names = new Set(tokenNames(contract));
  for (const tok of scanTemplateTokens(src)) {
    if (!names.has(tok)) throw new Error(`template token not in registry: ${tok}`);
  }
}

/** Skeleton + zone check over the CONTRACT byte plane (Task 20 ④): 壳零注入 + 槽仅现所属区.
 * - shell zone: zero residual moustache (壳零残余 moustache); opens the Instructions/Handoff sections;
 * - return constants: byte constants (zero moustache), each opening `## Return`;
 * - round-context: the only moustache zone — every round-zone token renders there, return-zone
 *   tokens surface as literal labels only (never moustaches), and any `{{> clause}}` reference
 *   resolves to a registered clause (T12 assembler);
 * - skeleton{ sections, slots-level segments, order } matches the assembled plane. */
export function validateTemplateStructure(contract: TemplateContract = loadTemplateContract()): void {
  const shellSrc = joinLines(contract.sections.shell);
  // 壳零注入: the shell embeds zero moustache slots (real values ride ## Round context).
  if (shellSrc.includes("{{")) {
    throw new Error("shell zone must be slot-free (zero moustache) — embed per-dispatch values as ## Round context slots");
  }
  const roundSrc = joinLines(contract.sections["round-context"]);
  if (!roundSrc.startsWith("## Round context")) {
    throw new Error("round-context zone must open with `## Round context`");
  }
  for (const [format, lines] of Object.entries(contract.sections.return)) {
    const src = joinLines(lines);
    if (!src.startsWith("## Return")) throw new Error(`return constant ${format} must open with ## Return`);
    if (src.includes("{{")) throw new Error(`return constant ${format} must be a literal constant (zero moustache)`);
  }
  // 槽仅现所属区: each registry token renders only inside its own zone's source.
  if (JSON.stringify(contract.skeleton.sections) !== JSON.stringify(["Instructions", "Handoff", "Return", "Round context"])) {
    throw new Error(`skeleton.sections mismatch: got [${contract.skeleton.sections.join(", ")}]`);
  }
  if (JSON.stringify(contract.skeleton.segments.shell) !== JSON.stringify(["Instructions", "Handoff"])) {
    throw new Error("skeleton.segments.shell must be slot-level [Instructions, Handoff]");
  }
  if (JSON.stringify(contract.skeleton.segments.return) !== JSON.stringify(["Return"])) {
    throw new Error("skeleton.segments.return must be slot-level [Return]");
  }
  if (JSON.stringify(contract.skeleton.segments["round-context"]) !== JSON.stringify(["Round context"])) {
    throw new Error('skeleton.segments["round-context"] must be slot-level [Round context]');
  }
  if (JSON.stringify(contract.skeleton.order) !== JSON.stringify(["shell", "return", "round-context"])) {
    throw new Error("skeleton.order must be [shell, return, round-context] (段序恒为 壳 → Return → Round context)");
  }
  const zoneSource: Record<string, string> = {
    return: Object.values(contract.sections.return).map(joinLines).join("\n"),
    "round-context": roundSrc,
  };
  for (const tok of contract.tokens) {
    if (tok.zone === "shell") throw new Error(`token ${tok.name}: shell is slot-free (壳禁槽)`);
    const src = zoneSource[tok.zone];
    if (!src) throw new Error(`unknown zone ${tok.zone} for token ${tok.name}`);
    if (tok.zone === "return") {
      if (src.includes(`{{${tok.name}}}`)) {
        throw new Error(`return token {{${tok.name}}} must surface as a literal label, not a moustache`);
      }
    } else if (!src.includes(`{{${tok.name}}}`)) {
      throw new Error(`token {{${tok.name}}} must render inside its ${tok.zone} zone source`);
    }
  }
  // 槽仅现所属区（反向）：round-context 区内实际渲染的每个 moustache 都必须是 round-zone token
  //（壳禁槽 + 单动态区 —— 一个 round 槽不得缺席 registry，也不得是别区 token 的注入通道）。
  const roundZoneNames = new Set(contract.tokens.filter((t) => t.zone === "round-context").map((t) => t.name));
  for (const tok of scanTemplateTokens(roundSrc)) {
    if (!roundZoneNames.has(tok)) {
      throw new Error(`slot {{${tok}}} must be a round-context token (槽仅现所属区)`);
    }
  }
  // clauses assembler surface: any `{{> name}}` in a zone must resolve to a registered clause.
  for (const src of [shellSrc, roundSrc, ...Object.values(contract.sections.return).map(joinLines)]) {
    for (const name of [...src.matchAll(/\{\{>\s*([\w-]+)\}\}/g)].map((m) => m[1])) {
      if (!(name in contract.clauses)) throw new Error(`unknown clause partial: {{> ${name}}}`);
    }
  }
}

/** Validate the shipped contract plane (structural + token registry) — returns the zone keys on
 * pass (the former per-file template sweep retires with the .md files). */
export function validateShippedTemplates(): string[] {
  const data = loadTemplateContract();
  validateTemplateStructure(data);
  validateTemplateTokens(joinLines(data.sections["round-context"]), data);
  return Object.keys(data.sections);
}

// ---- clauses assembler (Task 20 与 T12 衔接：{{> clause}} 引用机制面) ----
// #clauses = container of discipline-clause bodies (T12 lands them); the assembler registers each
// clause as a handlebars partial so a `{{> clause}}` reference in the round-context zone resolves
// at render. Wired into loadTemplateContract() (memoized with the contract, idempotent — empty
// container → no-op; the validator already rejects unknown refs at validate time).

export function clauseNames(contract: TemplateContract = loadTemplateContract()): string[] {
  return Object.keys(contract.clauses);
}

export function assembleClauses(contract: TemplateContract = loadTemplateContract()): void {
  for (const [name, body] of Object.entries(contract.clauses)) {
    hb.registerPartial(name, String(body));
  }
}

// ---- dispatch prompt composition (renderModePrompt / renderTemplate: the sole renderer) ----

function buildReviewRound(name: string, params: Record<string, unknown>): Record<string, unknown> {
  const cfg = reviewTypeConfig("task");
  const art = reviewArtifactConfig("task");
  const workspace = params.TASK_WORKSPACE ? String(params.TASK_WORKSPACE) : "";
  const round: Record<string, unknown> = {
    MODE: "review",
    REVIEW_TYPE: "task",
    TASK_WORKSPACE: workspace,
    WORKSPACE_SLUG: params.WORKSPACE_SLUG ?? (workspace ? path.basename(workspace) : ""),
    REVIEW_LENS_GUIDE: cfg.lensEnum.join(" · "),
    REVIEW_REFERENCE: params.TASK_FIXED_POINT ? `${params.TASK_FIXED_POINT}..HEAD` : cfg.ref,
    REVIEW_AXES: cfg.axesGuide,
    HANDOFF_TARGET: params.HANDOFF_TARGET ?? "",
    REVIEW_PLAN_LINE: params.REVIEW_PLAN_LINE ?? "",
    HANDOFF_WRITE_GATE: reviewHardGate(art.returnFormat, params.HANDOFF_TARGET),
    TASK_FIXED_POINT: params.TASK_FIXED_POINT ?? "",
    RETURN_FORMAT: art.returnFormat,
  };
  return { ...params, ...round };
}

// params = promptParams (produced by buildPromptParams): round-context interpolation keys +
// REVIEW_PLAN_LINE. REVIEW_PLAN_LINE comes from the caller deriving it off the **explicit plan
// path** and passing it via params — this layer reads zero env, and never introduces an env key
// named after a plan path (that key name is the hit surface of the "derived values must not ride
// the env" guard).
export function renderModePrompt(mode: string, params: Record<string, unknown> = {}): string {
  // review mode routes through the type=task config (template-contract reviews), concrete-izing
  // REFERENCE as FIXED_POINT..HEAD and skipping any template name map (no files; unified shell).
  if (mode === "review") {
    return renderTemplate("review", buildReviewRound("review", params));
  }
  // implement/fix share the task-family shell + RETURN_STDOUT_BLOCK return; only the
  // HANDOFF_WRITE_GATE / MODE values differ (fix = write-before-return; implement = no handoff,
  // runner materializes). No schema slot replace remains — the shellFor schema block is baked.
  return renderTemplate(mode, {
    ...params,
    MODE: mode,
    HANDOFF_WRITE_GATE: mode === "fix" ? reviewHardGate("RETURN_STDOUT_BLOCK", params.HANDOFF_TARGET) : implementHardGate(params.HANDOFF_TARGET, params.TASK_NUMBER),
    RETURN_FORMAT: defaultReturnFormat(),
  });
}

/** Assemble one dispatch prompt — C1-max byte layout: 壳(租户常数) → ## Return(字节常数) →
 * ## Round context(唯一动态区). family routes by RETURN_FORMAT (docs = RETURN_JSON/DOCS_FIX,
 * else task); missing round slots pre-fill "" (mode-union template, no strict missing-param
 * throw); the tail memoizes by canonical params (identical re-dispatch = zero re-render). */
export function renderTemplate(name: string, params: Record<string, unknown>, programName?: string): string {
  const returnFormat = typeof params.RETURN_FORMAT === "string" ? params.RETURN_FORMAT : defaultReturnFormat();
  const family = familyFor(returnFormat);
  return (
    shellFor(family) + "\n" + returnFor(returnFormat) + renderRoundContext(name, params, programName)
  );
}