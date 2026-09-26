// packages/cdd-engine/src/render/templates.ts — TemplateLoader class (Task 20 C1-max byte-layout
// layer spec D-3; Task 7 OOP restructure Criterion ② — the template-contract load/validate/render +
// review-config + gate atoms are ALL instance methods, zero bare function exports; the former
// module-level CACHE state already lives in CddRuntime (Task 4 ①) and the loader receives it via
// constructor injection). Single renderer + runtime assembly over template-contract.json#sections — the four
// template .md files merged into the contract's zone storage (single-file rendering data plane),
// zero handwritten templates:
//   sections.shell      → one literal-constant shell (full shared frame; zero injection slots in the shell)
//   sections.return     → byte-constant `## Return` per return format
//   sections.round-context → the ONLY dynamic zone (absolute end; all per-dispatch values)
// Segment order is fixed: shell → ## Return → ## Round context. The shell is a process-level
// parameterless constant (C4: compiled once, reused forever; the per-dispatch shell cache key is
// eliminated) —
// renderTemplate renders only the Round-context tail (per dispatch params) on top of the frozen
// shell + return bytes. The living consumers of this single renderer: dispatch/branch.ts
// BranchLifecycle (branch-review / branch-fix channels) + the cli/review.ts composite root
// (templatePath / TEMPLATE_FILES retired — no template files remain).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// handlebars is CommonJS (no export map): Node ESM can only see `default` / `module.exports`,
// so the default-import + destructure form is the interop-safe spelling used everywhere (vitest
// and the plain-node validate chains both resolve hb.compile to the compile function).
import hb from "handlebars";
import { resolvePackageRoot } from "../infra/resource.ts";

const compile = hb.compile;

import { familyConfig } from "../artifacts/handoff/naming.ts";
import { invariant } from "../infra/exit.ts";
import { runtime, type TemplateCacheSlots, type TemplateCacheStats } from "../infra/runtime.ts";
import { HandoffSchemaValidator } from "../rules/schema.ts";

// PKG_ROOT = <pkg>/templates — the render data plane's resource dir (contract + schemas alone;
// re-org Step 5 semantics converged here; consumers use the constant directly).
// Resolved by the nearest-ancestor package.json marker walk (same state-independent convention as
// infra/config.ts / documents/schema.ts) — the `../../templates` hop worked from src/render/ but
// lands one level too high from the real bundle (dist/, consumer install): a bundled cli.mjs at
// <pkg>/dist/ + `../..` = the parent of <pkg>, not <pkg>. The marker walk resolves <pkg>/templates
// in every file state (dev stub src tree, dist bundle, consumer install).

export const PKG_ROOT = path.join(
  resolvePackageRoot(path.dirname(fileURLToPath(import.meta.url))),
  "templates",
);

// ---- template-contract (the rendering data plane): skeleton + zone sections + zone-tagged
// token registry + clauses container (T12) + reviews content config. templates.ts is this
// plane's only loader / assembler (config.ts reads engine-config.json separately). ----
export interface TemplateZoneToken {
  name: string;
  /** Shell slot-free: zone ∈ { return, round-context } — never "shell" (the shell embeds zero slots). */
  zone: string;
}

export interface TemplateContract {
  $version: number;
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

export const LINE_BUDGETS = Object.freeze({
  sdd: 210,
  ctrl: 50,
  tier1: 260,
  tier2: 331,
});

export interface ReviewTypeConfig {
  lensEnum: string[];
  ref: string;
  axesGuide: string;
}

const CONTRACT_REL = "template-contract.json";

function joinLines(lines: string[]): string {
  return `${lines.join("\n")}\n`;
}

// returnFormat → shell family: the docs family owns RETURN_JSON (spec/plan review) and DOCS_FIX
// (spec/plan fix); everything else (RETURN_STDOUT_BLOCK / absent) is the task family. No
// switch-statement — a const discriminator map (residue guard: templates.ts is switch-free, and
// writing the forbidden token's literal shape here trips the guard's own scan).
const DOCS_FORMATS = Object.freeze(["RETURN_JSON", "DOCS_FIX"]);

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

/** Extract all `{{TOKEN}}` tokens declared in the text. */
function scanTemplateTokens(src: string): string[] {
  return [...src.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]);
}

/** TemplateLoader — the template-contract plane's only loader/assembler/renderer (Criterion ②;
 *  constructor injection — the render cache slots default to the CddRuntime-owned templateCache (Task 4 ①), the
 *  schema reader (HandoffSchemaValidator) defaults to a fresh instance). Every load / validate / render
 *  atom is an instance method; the memoized cache state lives on the injected slots, never a
 *  module-level mutable. */
export class TemplateLoader {
  /** The runtime-owned render cache — narrowed to the renderer's concrete slot types (the runtime
   * carries the loose TemplateCacheSlots shape; the render helpers own the render-specific types). */
  readonly #cache: TemplateCacheSlots & {
    contract: TemplateContract | null;
    compiledRound: ReturnType<typeof compile> | null;
  };
  readonly #schema: HandoffSchemaValidator;

  constructor(cache?: TemplateCacheSlots) {
    this.#cache = (cache ?? runtime.templateCache) as TemplateCacheSlots & {
      contract: TemplateContract | null;
      compiledRound: ReturnType<typeof compile> | null;
    };
    this.#schema = new HandoffSchemaValidator();
  }

  templateCacheStats(): TemplateCacheStats {
    return {
      reads: this.#cache.reads,
      compiles: this.#cache.compiles,
      tailRenders: this.#cache.tailRenders,
    };
  }

  resetTemplateCaches(): void {
    this.#cache.contract = null;
    this.#cache.shells.clear();
    this.#cache.returns.clear();
    this.#cache.compiledRound = null;
    this.#cache.roundTokens = [];
    this.#cache.rounds.clear();
    this.#cache.shellFrameRendered = null;
    this.#cache.reads = 0;
    this.#cache.compiles = 0;
    this.#cache.tailRenders = 0;
  }

  loadTemplateContract(): TemplateContract {
    if (!this.#cache.contract) {
      this.#cache.contract = JSON.parse(
        readFileSync(path.join(PKG_ROOT, CONTRACT_REL), "utf8"),
      ) as TemplateContract;
      this.#cache.reads++;
      // Partial assembly is memoized with the contract (T12 wiring; idempotent, empty
      // container = no-op) — every render path runs loadTemplateContract before compiling
      // a round context, so registered {{> clause}} refs always resolve.
      this.assembleClauses(this.#cache.contract);
    }
    return this.#cache.contract;
  }

  lineBudget(tier: string): number {
    if (!(tier in LINE_BUDGETS)) invariant(false, `unknown line budget tier: ${tier}`);
    return LINE_BUDGETS[tier as keyof typeof LINE_BUDGETS];
  }

  // pluginRoot() = the template resource dir (PKG_ROOT) — run-task step 2.5 existence check targets
  // pluginRootFn() directly (the dir holds the contract + schemas).
  pluginRoot(): string {
    return PKG_ROOT;
  }

  // ---- Handoff contract injection (Task 18: schema verbatim; zero render) ----
  // Contract uniqueness (schema) → injection uniqueness (its string form). The schema is the only
  // per-family injection the shell carries: shellFor(family) = shared frame + this block.
  renderHandoffSchemaJson(schema: unknown): string {
    return `\`\`\`json\n${JSON.stringify(schema)}\n\`\`\``;
  }

  // ---- zone builders (runtime assembly; all memoized / frozen) ----

  /** Registry token names in registry order. */
  tokenNames(contract: TemplateContract = this.loadTemplateContract()): string[] {
    return contract.tokens.map((t) => t.name);
  }

  /** zone → its tokens (registry ownership: a slot renders only in its own zone). */
  tokensInZone(zone: string, contract: TemplateContract = this.loadTemplateContract()): string[] {
    return contract.tokens.filter((t) => t.zone === zone).map((t) => t.name);
  }

  // C4 parameterless shell constant (T12/D1.2): the shared shell frame is compiled + rendered ONCE per process —
  // clause partial refs ({{> cl:…}}) resolve against the clause library registered at contract load
  // (assembleClauses runs inside loadTemplateContract — always before the first shell assembly). The
  // frame is parameterless (zero per-dispatch values — zero shell injection); the per-family schema block is the
  // only injected bytes. Non-strict compile: the shell carries no variables — only literal text +
  // clause refs — so token-slot leaks are the structure validator's job (validateTemplateStructure),
  // not the compile's (the round-context strict compile stays strict).
  #shellFrame(): string {
    if (this.#cache.shellFrameRendered === null) {
      const frame = joinLines(this.loadTemplateContract().sections.shell);
      this.#cache.shellFrameRendered = compile(frame)({});
      this.#cache.compiles++;
    }
    return this.#cache.shellFrameRendered;
  }

  /** family → the frozen shell = shared frame (clause refs resolved once) + the family's schema
   * block (frames end with the "per the schema below" prose; the schema block is the only injected
   * bytes). */
  #shellFor(family: string): string {
    let shell = this.#cache.shells.get(family);
    if (shell === undefined) {
      const block = this.renderHandoffSchemaJson(this.#schema.loadHandoffSchema(family));
      shell = `${this.#shellFrame()}\n${block}`;
      this.#cache.shells.set(family, shell);
    }
    return shell;
  }

  /** return format → the frozen `## Return` constant. */
  #returnFor(format: string): string {
    let out = this.#cache.returns.get(format);
    if (out === undefined) {
      const lines = this.loadTemplateContract().sections.return[format];
      if (!lines) invariant(false, `unknown return format: ${format}`);
      out = joinLines(lines);
      this.#cache.returns.set(format, out);
    }
    return out;
  }

  #familyFor(returnFormat: unknown): string {
    return typeof returnFormat === "string" && DOCS_FORMATS.includes(returnFormat)
      ? "docs"
      : "task";
  }

  #defaultReturnFormat(): string {
    return "RETURN_STDOUT_BLOCK";
  }

  /** Render the Round-context tail (the ONLY dynamic zone) — compile once, memoize per canonical
   * params, pre-fill absent round slots with "" (mode-union template: strictness is impossible
   * across modes; the legacy missing-param throw retires with the per-template files). */
  #renderRoundContext(
    name: string,
    params: Record<string, unknown>,
    programName: string | undefined,
  ): string {
    const roundSrc = joinLines(this.loadTemplateContract().sections["round-context"]);
    if (!this.#cache.compiledRound) {
      this.#cache.compiledRound = compile(tripleAll(roundSrc), { strict: true });
      this.#cache.compiles++;
      this.#cache.roundTokens = scanTemplateTokens(roundSrc);
    }
    const filled: Record<string, unknown> = {};
    for (const key of this.#cache.roundTokens) filled[key] = params[key] ?? "";
    const key = canonicalKey(filled);
    let out = this.#cache.rounds.get(key);
    if (out === undefined) {
      try {
        out = this.#cache.compiledRound(filled);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const missing = msg.match(/^"([^"]+)" not defined/);
        if (missing) {
          invariant(false, `${programName}: template ${name}: missing param ${missing[1]}`);
        }
        throw err;
      }
      this.#cache.tailRenders++;
      this.#cache.rounds.set(key, out);
    }
    return out;
  }

  // ---- Review template data-driven (template-contract.json#reviews per-type config + shared shell) ----

  loadReviews(): Record<string, unknown> {
    return this.loadTemplateContract().reviews;
  }

  // #reviews[type] → pure content contract { lensEnum, ref, axesGuide } (T2 axis cut:
  // returnFormat/handoffType/fixTemplate moved to canonical; artifact reads go through
  // reviewArtifactConfig). task/branch refs are git-range symbols (REVIEW_REFERENCE ← concrete
  // FIXED_POINT..HEAD / BASE..HEAD); spec/plan refs are relational descriptions (doc vs spec), the
  // actual doc path lands on REVIEW_REFERENCE via the caller.
  reviewTypeConfig(type: string): ReviewTypeConfig {
    const cfg = this.loadReviews()[type] as ReviewTypeConfig | undefined;
    if (!cfg) invariant(false, `unknown review type: ${type}`);
    return cfg;
  }

  // reviewArtifactConfig(type) → reads the canonical handoffNamespace review.{type} family, returns
  // { schema, returnFormat } — the unique source of the RETURN_FORMAT template param; returnFormat ∈
  // {"RETURN_STDOUT_BLOCK", "RETURN_JSON"} (the canonical return-contract discriminator). fixTemplate
  // is not surfaced by this layer (runFix reads the fix family directly; no second read point).
  reviewArtifactConfig(type: string): { schema: string; returnFormat: string } {
    const cfg = familyConfig("review", type) as unknown as { schema: string; returnFormat: string };
    return { schema: cfg.schema, returnFormat: cfg.returnFormat };
  }

  // review.md HANDOFF_WRITE_GATE (T6; HARD_GATE → HANDOFF_WRITE_GATE naming): returnFormat
  // split-writes — RETURN_STDOUT_BLOCK → "BEFORE outputting the RETURN_STDOUT_BLOCK"; RETURN_JSON →
  // "BEFORE outputting the JSON return". Task 20: the gate VALUE (real handoff path) rides the
  // Round-context `### HANDOFF_WRITE_GATE` slot — the shell prose is byte constant. Illicit
  // returnFormat → RETURN_STDOUT_BLOCK default (unknown families must not crash rendering).
  reviewHardGate(returnFormat: string, handoffPath?: unknown): string {
    const before =
      returnFormat === "RETURN_JSON"
        ? "BEFORE outputting the JSON return."
        : "BEFORE outputting the RETURN_STDOUT_BLOCK.";
    const target = handoffPath ?? "{{HANDOFF_TARGET}}";
    return `> ⚠️ HARD GATE — Write \`${target}\` ${before}\n> Returning without a written handoff file = BLOCKED (runner exit 1).`;
  }

  // docs-family fix (cdd fix --type spec|plan) HANDOFF_WRITE_GATE (Task 18 review-1 finding 2):
  // fix's return IS the on-disk write (the DOCS_FIX return constant says "the engine reads the
  // file, not your stdout"; no JSON return on stdout). Must not reuse reviewHardGate("RETURN_JSON")
  // — "BEFORE outputting the JSON return" would self-contradict for a fix agent. Gate semantics =
  // exit only after the write.
  docsFixHardGate(handoffPath?: unknown): string {
    const target = handoffPath ?? "{{HANDOFF_TARGET}}";
    return `> ⚠️ HARD GATE — Write \`${target}\` BEFORE exiting: the engine reads the file, not your stdout. Returning without a written handoff file = BLOCKED (runner exit 1).`;
  }

  // implement's HANDOFF_WRITE_GATE: this mode does not write a handoff (the runner materializes it
  // from the return block four lines + TASK_BASE + git HEAD), isomorphic to fix/review's
  // "write-before-return" but semantically inverted — the shared-Handoff-shell slot's injected
  // value, not a template difference. Artifacts (report + test evidence) come first: the materialized
  // handoff's artifacts all come from them; absent → BLOCKED.
  #implementHardGate(handoffPath: unknown, dispatchUnit: unknown): string {
    const target = handoffPath || `tasks-${dispatchUnit}-implement.json`;
    return `> ⚠️ HARD GATE — This mode does not write \`${target}\`: the runner materializes it from your return block four lines + the brief's \`TASK_BASE\` + \`git HEAD\`. Write the implementer report + test evidence BEFORE outputting the return block — returning without them = BLOCKED (runner exit 1).`;
  }

  // ---- token registry (Task 5 D1.4 + Task 20 zones) — driven/validated by template-contract.json ----

  /** Assert the text uses only registry tokens (unknown/legacy name → throw). */
  validateTemplateTokens(
    src: string,
    contract: TemplateContract = this.loadTemplateContract(),
  ): void {
    const names = new Set(this.tokenNames(contract));
    for (const tok of scanTemplateTokens(src)) {
      if (!names.has(tok)) invariant(false, `template token not in registry: ${tok}`);
    }
  }

  /** Skeleton + zone check over the CONTRACT byte plane (Task 20 ④ + T12/D1.2): zero shell injection +
   * a slot renders only in its own zone.
   * - shell zone: zero *token* moustache (zero residual token slots in the shell; `{{> clause}}` partial refs are the
   *   single-source discipline markers — assembly slots, not per-dispatch values — so they are
   *   permitted); opens the Instructions/Handoff sections;
   * - return constants: byte constants (zero moustache — no slots, no clause refs), each opening
   *   `## Return`;
   * - round-context: the only moustache zone — every round-zone token renders there, return-zone
   *   tokens surface as literal labels only (never moustaches), and any `{{> clause}}` reference
   *   resolves to a registered clause (T12 assembler);
   * - skeleton{ sections, slots-level segments, order } matches the assembled plane. */
  validateTemplateStructure(contract: TemplateContract = this.loadTemplateContract()): void {
    const shellSrc = joinLines(contract.sections.shell);
    // Zero shell injection (T12 revision): the shell embeds zero per-dispatch *slots* — token moustaches
    // ({{TOKEN}} / {{{TOKEN}}}) are banned; `{{> clause}}` partial refs (single-source discipline
    // markers, resolved once at load) are allowed. The guard keys on token-slot shapes, not `{{`
    // presence; real per-dispatch values ride ## Round context slots.
    if (/\{\{(?!>\s*)/.test(shellSrc)) {
      invariant(
        false,
        "shell zone must be slot-free (zero token moustache) — embed per-dispatch values as ## Round context slots; only {{> clause}} refs are allowed",
      );
    }
    const roundSrc = joinLines(contract.sections["round-context"]);
    if (!roundSrc.startsWith("## Round context")) {
      invariant(false, "round-context zone must open with `## Round context`");
    }
    for (const [format, lines] of Object.entries(contract.sections.return)) {
      const src = joinLines(lines);
      if (!src.startsWith("## Return"))
        invariant(false, `return constant ${format} must open with ## Return`);
      if (src.includes("{{"))
        invariant(false, `return constant ${format} must be a literal constant (zero moustache)`);
    }
    // A slot renders only in its own zone: each registry token renders only inside its own zone's source.
    if (
      JSON.stringify(contract.skeleton.sections) !==
      JSON.stringify(["Instructions", "Handoff", "Return", "Round context"])
    ) {
      invariant(
        false,
        `skeleton.sections mismatch: got [${contract.skeleton.sections.join(", ")}]`,
      );
    }
    if (
      JSON.stringify(contract.skeleton.segments.shell) !==
      JSON.stringify(["Instructions", "Handoff"])
    ) {
      invariant(false, "skeleton.segments.shell must be slot-level [Instructions, Handoff]");
    }
    if (JSON.stringify(contract.skeleton.segments.return) !== JSON.stringify(["Return"])) {
      invariant(false, "skeleton.segments.return must be slot-level [Return]");
    }
    if (
      JSON.stringify(contract.skeleton.segments["round-context"]) !==
      JSON.stringify(["Round context"])
    ) {
      invariant(false, 'skeleton.segments["round-context"] must be slot-level [Round context]');
    }
    if (
      JSON.stringify(contract.skeleton.order) !==
      JSON.stringify(["shell", "return", "round-context"])
    ) {
      invariant(
        false,
        "skeleton.order must be [shell, return, round-context] (segment order is always shell → Return → Round context)",
      );
    }
    const zoneSource: Record<string, string> = {
      return: Object.values(contract.sections.return).map(joinLines).join("\n"),
      "round-context": roundSrc,
    };
    for (const tok of contract.tokens) {
      if (tok.zone === "shell")
        invariant(false, `token ${tok.name}: shell is slot-free (shell zero-slot rule)`);
      const src = zoneSource[tok.zone];
      if (!src) invariant(false, `unknown zone ${tok.zone} for token ${tok.name}`);
      if (tok.zone === "return") {
        if (src.includes(`{{${tok.name}}}`)) {
          invariant(
            false,
            `return token {{${tok.name}}} must surface as a literal label, not a moustache`,
          );
        }
      } else if (!src.includes(`{{${tok.name}}}`)) {
        invariant(false, `token {{${tok.name}}} must render inside its ${tok.zone} zone source`);
      }
    }
    // A slot renders only in its own zone (reverse direction): every moustache actually rendered in
    // the round-context zone must be a round-zone token (shell slot-free + single dynamic zone: a
    // round slot may neither be absent from the registry nor be another zone token's injection channel).
    const roundZoneNames = new Set(
      contract.tokens.filter((t) => t.zone === "round-context").map((t) => t.name),
    );
    for (const tok of scanTemplateTokens(roundSrc)) {
      if (!roundZoneNames.has(tok)) {
        invariant(
          false,
          `slot {{${tok}}} must be a round-context token (a slot renders only in its own zone)`,
        );
      }
    }
    // clauses assembler surface: any `{{> name}}` in a zone must resolve to a registered clause
    // (T12: clause ids carry the `cl:` namespace — `:` joins the partial-name alphabet).
    for (const src of [
      shellSrc,
      roundSrc,
      ...Object.values(contract.sections.return).map(joinLines),
    ]) {
      for (const name of [...src.matchAll(/\{\{>\s*([\w:-]+)\}\}/g)].map((m) => m[1])) {
        if (!(name in contract.clauses)) invariant(false, `unknown clause partial: {{> ${name}}}`);
      }
    }
  }

  /** Validate the shipped contract plane (structural + token registry) — returns the zone keys on
   * pass (the former per-file template sweep retires with the .md files). */
  validateShippedTemplates(): string[] {
    const data = this.loadTemplateContract();
    this.validateTemplateStructure(data);
    this.validateTemplateTokens(joinLines(data.sections["round-context"]), data);
    return Object.keys(data.sections);
  }

  // ---- clauses assembler (Task 20 T12 wiring: the {{> clause}} reference mechanism face) ----

  clauseNames(contract: TemplateContract = this.loadTemplateContract()): string[] {
    return Object.keys(contract.clauses);
  }

  assembleClauses(contract: TemplateContract = this.loadTemplateContract()): void {
    for (const [name, body] of Object.entries(contract.clauses)) {
      hb.registerPartial(name, String(body));
    }
  }

  // ---- dispatch prompt composition (renderModePrompt / renderTemplate: the sole renderer) ----

  #buildReviewRound(_name: string, params: Record<string, unknown>): Record<string, unknown> {
    const cfg = this.reviewTypeConfig("task");
    const art = this.reviewArtifactConfig("task");
    const workspace = params.WORKSPACE ? String(params.WORKSPACE) : "";
    const round: Record<string, unknown> = {
      MODE: "review",
      REVIEW_TYPE: "task",
      WORKSPACE: workspace,
      WORKSPACE_SLUG: params.WORKSPACE_SLUG ?? (workspace ? path.basename(workspace) : ""),
      REVIEW_LENS_GUIDE: cfg.lensEnum.join(" · "),
      REVIEW_REFERENCE: params.FIXED_POINT ? `${params.FIXED_POINT}..HEAD` : cfg.ref,
      REVIEW_AXES: cfg.axesGuide,
      HANDOFF_TARGET: params.HANDOFF_TARGET ?? "",
      REVIEW_PLAN_LINE: params.REVIEW_PLAN_LINE ?? "",
      HANDOFF_WRITE_GATE: this.reviewHardGate(art.returnFormat, params.HANDOFF_TARGET),
      FIXED_POINT: params.FIXED_POINT ?? "",
      RETURN_FORMAT: art.returnFormat,
    };
    return { ...params, ...round };
  }

  // params = promptParams (produced by buildPromptParams): round-context interpolation keys +
  // REVIEW_PLAN_LINE. REVIEW_PLAN_LINE comes from the caller deriving it off the **explicit plan
  // path** and passing it via params — this layer reads zero env, and never introduces an env key
  // named after a plan path (that key name is the hit surface of the "derived values must not ride
  // the env" guard).
  renderModePrompt(mode: string, params: Record<string, unknown> = {}): string {
    // review mode routes through the type=task config (template-contract reviews), concrete-izing
    // REFERENCE as FIXED_POINT..HEAD and skipping any template name map (no files; unified shell).
    if (mode === "review") {
      return this.renderTemplate("review", this.#buildReviewRound("review", params));
    }
    // implement/fix share the task-family shell + RETURN_STDOUT_BLOCK return; only the
    // HANDOFF_WRITE_GATE / MODE values differ (fix = write-before-return; implement = no handoff,
    // runner materializes). No schema slot replace remains — the shellFor schema block is baked.
    return this.renderTemplate(mode, {
      ...params,
      MODE: mode,
      HANDOFF_WRITE_GATE:
        mode === "fix"
          ? this.reviewHardGate("RETURN_STDOUT_BLOCK", params.HANDOFF_TARGET)
          : this.#implementHardGate(params.HANDOFF_TARGET, params.DISPATCH_UNIT),
      RETURN_FORMAT: this.#defaultReturnFormat(),
    });
  }

  /** Assemble one dispatch prompt — C1-max byte layout: shell (tenant constant) → ## Return (byte constant) →
   * ## Round context (the only dynamic zone). family routes by RETURN_FORMAT (docs = RETURN_JSON/DOCS_FIX,
   * else task); missing round slots pre-fill "" (mode-union template, no strict missing-param
   * throw); the tail memoizes by canonical params (identical re-dispatch = zero re-render). */
  renderTemplate(name: string, params: Record<string, unknown>, programName?: string): string {
    const returnFormat =
      typeof params.RETURN_FORMAT === "string" ? params.RETURN_FORMAT : this.#defaultReturnFormat();
    const family = this.#familyFor(returnFormat);
    return (
      this.#shellFor(family) +
      "\n" +
      this.#returnFor(returnFormat) +
      this.#renderRoundContext(name, params, programName)
    );
  }
}
