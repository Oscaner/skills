// scripts/lib/contract-lexicon.ts — the CDD contract-lexicon guard (C6, P3 T4). ONE class drives
// the four converged check faces the plan pinned: the skill-anatomy assertions (checkAnatomy —
// the digraph-consistency surface), the G2 cursor binary-name live-face residue collector
// (checkResidue — the former collectCursorAgentHits), the C7 shape-restate wording guard
// (checkWording — orchestrator skills keep zero engine-shape special-name literals), and the
// engine-config channel audit (checkConfig — the former context.test channel assertions). The
// class reads contract-lexicon.json (packages/cdd-engine/src/infra/ — the repo source single; the
// dist/resources copy rides the published package) as its data source: the scan token / data-row
// basenames / banned shape names all come from the lexicon, never a hand-written allowlist — a
// behavior change goes through the word table, not through this file.
//
// Criterion ②: the guard surface is instance methods, zero bare-function exports (module-private
// helpers stay private). The guarded binary-name lexeme is CARRIED by the lexicon data rows, so
// this guard body never holds the lexeme contiguously — a live face (scripts/) must not become a
// carrier of the vocabulary it guards (the scripts face scan sits in the same G2 sweep).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { escapeRegExp, isDataRow, scanLines } from "./scan.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const DEFAULT_LEXICON_PATH = path.join(ROOT, "packages/cdd-engine/src/infra/contract-lexicon.json");
const DEFAULT_REGISTRY_PATH = path.join(
  ROOT,
  "packages/cdd-engine/src/infra/harness-registry.json",
);

// ---------------------------------------------------------------------------
// Guard finding shapes (one per check face; the validate block + tests consume these)
// ---------------------------------------------------------------------------

export interface AnatomySkill {
  name: string;
  path: string;
}

export interface AnatomyFinding {
  category: string;
  message: string;
}

export interface ResidueFace {
  targets: string[];
  includeTests: boolean;
}

export interface ResidueFinding {
  label: string;
  file: string;
}

export interface WordingFinding {
  label: string;
  file: string;
  line: number;
}

export interface ConfigFinding {
  label: string;
  file: string;
}

interface LexiconData {
  harness: { ids: string[]; clis: Record<string, string> };
  status: { vocab: string[]; axes: { judgment: string[]; work: string[] } };
  stdout: { capsule: string[]; routeTokens: string[]; bannedShapeNames: string[] };
  residue: { dataSources: string[]; bannedToken: string; soleAllowed: string };
  anatomy: { schemaPath: string; skillsRoot: string };
}

// The three live residue faces and their test-site disposition (the per-face `__tests__` ruling
// the plan pins): engine src scans test sites (includeTests ON — the T1 zeroing must hold there
// too), scripts self-exempts its __tests__ (the guard's own regression-test position), docs/
// maintainers has no test sites and scans in full.
export const G2_LIVE_FACES: ResidueFace[] = [
  { targets: ["packages/cdd-engine/src"], includeTests: true },
  { targets: ["scripts"], includeTests: false },
  { targets: ["docs/maintainers"], includeTests: false },
];

// ---------------------------------------------------------------------------
// skill-anatomy parsing — the digraph-consistency assertion port. All structure facts come from
// the canonical skill-anatomy schema (single source, never a hard-coded structure literal); the
// lexicon's anatomy domain carries the schema path.
// ---------------------------------------------------------------------------

interface AnalyzedSkill {
  name: string;
  src: string;
  stripped: string;
  headings: { h2: string[]; h3: string[] };
  digraph: { mermaid: string | null; trailing: string };
  nodes: Array<{ id: string; type: string; label: string }>;
  edges: Array<{ from: string; label: string; to: string }>;
  sections: string[];
  blocks: Array<{ name: string; block: string }>;
}

function stripFences(src: string): string {
  return src.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*\n?/gm, (m) => m.replace(/[^\n]/g, ""));
}

function parseDigraph(src: string): {
  nodes: AnalyzedSkill["nodes"];
  edges: AnalyzedSkill["edges"];
} {
  const m = src.match(/```mermaid\n([\s\S]*?)```/);
  if (!m) return { nodes: [], edges: [] };
  const block = m[1];
  const nodes: AnalyzedSkill["nodes"] = [];
  const seen = new Set();
  const nodeRe = /(\w+)\[([^\]]+)\]|(\w+)\{([^}]+)\}|(\w+)\(\(([^)]+)\)\)/g;
  for (let mm = nodeRe.exec(block); mm !== null; mm = nodeRe.exec(block)) {
    const id = mm[1] || mm[3] || mm[5];
    const label = (mm[2] ?? mm[4] ?? mm[6] ?? "").trim();
    const type = mm[2] !== undefined ? "rect" : mm[4] !== undefined ? "diamond" : "terminal";
    if (seen.has(id)) continue; // re-declaration keeps the first id
    seen.add(id);
    nodes.push({ id, type, label });
  }
  const edges: AnalyzedSkill["edges"] = [];
  const edgeRe = /(\w+)(?:\[[^\]]*\]|\{[^}]*\}|\(\([^)]*\)\))?\s*-->\s*(?:\|([^|]*)\|)?\s*(\w+)/g;
  for (let em = edgeRe.exec(block); em !== null; em = edgeRe.exec(block)) {
    edges.push({ from: em[1], label: (em[2] || "").trim(), to: em[3] });
  }
  return { nodes, edges };
}

function extractSections(src: string): string[] {
  const sections = [];
  const re = /^### `([^`]+)`/gm;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) sections.push(m[1]);
  return sections;
}

function digraphSection(
  src: string,
  flowDigraphHeading: string,
): { mermaid: string | null; trailing: string } {
  const start = src.indexOf(flowDigraphHeading);
  if (start === -1) return { mermaid: null, trailing: "" };
  const afterHeading = src.slice(start + flowDigraphHeading.length);
  const relEnd = afterHeading.search(/\n#{1,3} /);
  const sectionText = relEnd === -1 ? afterHeading : afterHeading.slice(0, relEnd);
  const open = sectionText.indexOf("```mermaid");
  const close = open === -1 ? -1 : sectionText.indexOf("```", open + "```mermaid".length);
  const mermaid = open !== -1 && close !== -1 ? sectionText.slice(open, close + 3) : null;
  const trailing = close === -1 ? sectionText : sectionText.slice(close + 3);
  return { mermaid, trailing };
}

function nodeBlocks(src: string): AnalyzedSkill["blocks"] {
  const blocks: AnalyzedSkill["blocks"] = [];
  const re = /^### `([^`]+)`/gm;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    const rest = src.slice(m.index + m[0].length);
    const relEnd = rest.search(/\n(?=#{1,3} )/);
    blocks.push({ name: m[1], block: relEnd === -1 ? rest : rest.slice(0, relEnd) });
  }
  return blocks;
}

function analyzeSkill(name: string, src: string, flowDigraphHeading: string): AnalyzedSkill {
  const stripped = stripFences(src);
  return {
    name,
    src,
    stripped,
    headings: {
      h2: [...stripped.matchAll(/^## [^\n]*$/gm)].map((mm) => mm[0].trim()),
      h3: [...stripped.matchAll(/^### [^\n]*$/gm)].map((mm) => mm[0].trim()),
    },
    digraph: digraphSection(src, flowDigraphHeading),
    nodes: parseDigraph(src).nodes,
    edges: parseDigraph(src).edges,
    sections: extractSections(src),
    blocks: nodeBlocks(src),
  };
}

/**
 * The CDD contract-lexicon guard. Instance methods only (Criterion ②); the lexicon (and the
 * harness registry it mirrors) load from the repo source single. `lexiconPath` / `registryPath`
 * injection lets tests drive the guard against temp data sources.
 */
export class ContractLexiconGuard {
  readonly #lexicon: LexiconData;
  readonly #registryPath: string;

  constructor(opts: { lexiconPath?: string; registryPath?: string } = {}) {
    this.#lexicon = JSON.parse(
      readFileSync(opts.lexiconPath ?? DEFAULT_LEXICON_PATH, "utf8"),
    ) as LexiconData;
    this.#registryPath = opts.registryPath ?? DEFAULT_REGISTRY_PATH;
  }

  /** The loaded lexicon (test/assertion surface reads the same data the guard reads). */
  lexicon(): LexiconData {
    return this.#lexicon;
  }

  // -------------------------------------------------------------------------
  // checkAnatomy(skills?) — the digraph-consistency assertion surface
  // -------------------------------------------------------------------------

  #discoverSkills(): AnatomySkill[] {
    const root = path.join(ROOT, this.#lexicon.anatomy.skillsRoot);
    const out: AnatomySkill[] = [];
    for (const ent of readdirSync(root, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        const p = path.join(root, ent.name, "SKILL.md");
        if (existsSync(p)) out.push({ name: ent.name, path: p });
      }
    }
    return out;
  }

  /** checkAnatomy(skills?) — the schema-driven SKILL.md anatomy assertions (P13 governance test +
   *  P6 E1 flow atomicity; the migration target of packages/osuperpowers/tests/
   *  digraph-consistency.test.mjs). Every structure literal reads from the skill-anatomy schema
   *  (the lexicon's anatomy domain pins its path); skillsOverride lets tests inject temp skills.
   *  The growth report prints to stdout (the validate block's output face, same as the retired
   *  test); the return value is the aggregated findings list (empty = pass). */
  checkAnatomy(skillsOverride?: AnatomySkill[]): AnatomyFinding[] {
    const schemaPath = path.isAbsolute(this.#lexicon.anatomy.schemaPath)
      ? this.#lexicon.anatomy.schemaPath
      : path.join(ROOT, this.#lexicon.anatomy.schemaPath);
    const ANATOMY = JSON.parse(readFileSync(schemaPath, "utf8"));

    // Schema description text — the diagnostic wording the checks quote when a failure fires.
    const REGISTRY_RULE = ANATOMY.properties.sectionRegistry.description;
    const HEADING_KIND_RULE =
      ANATOMY.properties.sectionRegistry.properties.headingKinds.description;
    const DIGRAPH_CONTENT_RULE = ANATOMY.properties.digraph.properties.mermaidOnly.description;
    const NODE_ELEMENT_RULE = ANATOMY.properties.nodeElements.description;
    const NODE_DEFINITION_RULE = ANATOMY.properties.nodeDefinitions.description;
    const GROWTH_RULE = ANATOMY.properties.growthBoundary.description;
    const PURITY_RULE = ANATOMY.properties.consumerPurity.description;

    const reg = ANATOMY.properties.sectionRegistry.properties;
    const PUBLIC_SECTION_KEYS = reg.public.items.enum; // [flowDigraph, nodeDefinitions, invariants, failureModes]
    const CONDITIONAL_SECTION_KEYS = reg.conditional.items.enum; // [skeletonDeltas]
    const SECTION_HEADINGS = Object.fromEntries(
      Object.entries(reg.sections.properties).map(([key, node]) => [
        key,
        node.properties.heading.const,
      ]),
    );
    const ESCAPED_HEADING = Object.fromEntries(
      Object.entries(SECTION_HEADINGS).map(([key, h]) => [key, escapeRegExp(h)]),
    );
    const SECTION_HEADING_LINE = Object.fromEntries(
      Object.entries(ESCAPED_HEADING).map(([key, h]) => [key, new RegExp(`^${h}$`, "m")]),
    );
    const CONDITIONAL_CARRIERS = Object.fromEntries(
      CONDITIONAL_SECTION_KEYS.map((key) => [
        key,
        reg.sections.properties[key].properties.requiredCarriers.items.enum,
      ]),
    );
    const SKELETON_TRIO = CONDITIONAL_CARRIERS.skeletonDeltas;
    const NODE_HEADING_RE = new RegExp(reg.headingKinds.properties.nodeName.pattern, "m");
    const GROWTH_NODE_LIMIT = ANATOMY.properties.growthBoundary.properties.nodeLimit.const;
    const GROWTH_EDGE_LIMIT = ANATOMY.properties.growthBoundary.properties.edgeLimit.const;
    const REGISTERED_CROSSINGS = Object.keys(
      ANATOMY.properties.growthBoundary.properties.registry.properties.crossings.properties,
    );
    const FORBIDDEN_HEADS =
      ANATOMY.properties.consumerPurity.properties.forbiddenNarrativeHeads.items.enum.map(
        (h: string) => new RegExp(`^${escapeRegExp(h)}$`, "m"),
      );
    const ELEMENT_PATTERNS = Object.fromEntries(
      Object.entries(ANATOMY.properties.nodeElements.properties).map(([key, node]) => [
        key,
        new RegExp(node.pattern, "m"),
      ]),
    );

    const skills = skillsOverride ?? this.#discoverSkills();
    const flowDigraphHeading = SECTION_HEADINGS.flowDigraph;
    const findings: AnatomyFinding[] = [];

    const analyzed = skills.map(({ name, path: p }) => ({
      skill: { name, path: p },
      an: analyzeSkill(name, readFileSync(p, "utf8"), flowDigraphHeading),
    }));

    // Per-skill checks.
    for (const { an } of analyzed) {
      // Strict section-heading allowlist.
      const known = new Set(Object.values(SECTION_HEADINGS));
      const unknown = an.headings.h2.filter((h) => !known.has(h));
      for (const h of unknown) {
        findings.push({
          category: "registry-h2-external",
          message: `${an.name}: unregistered \`## \` heading(s): "${h}" — ${REGISTRY_RULE}`,
        });
      }
      const missingPublic = PUBLIC_SECTION_KEYS.filter(
        (key) => !an.headings.h2.includes(SECTION_HEADINGS[key]),
      );
      for (const k of missingPublic) {
        findings.push({
          category: "registry-h2-missing-public",
          message: `${an.name}: missing public section(s): \`${SECTION_HEADINGS[k]}\` — ${REGISTRY_RULE}`,
        });
      }
      for (const key of CONDITIONAL_SECTION_KEYS) {
        if (
          CONDITIONAL_CARRIERS[key].includes(an.name) &&
          !an.headings.h2.includes(SECTION_HEADINGS[key])
        ) {
          findings.push({
            category: "registry-h2-missing-conditional",
            message: `${an.name}: required conditional section \`${SECTION_HEADINGS[key]}\` missing (carrier of a conditional section) — ${REGISTRY_RULE}`,
          });
        }
      }
      for (const h of an.headings.h3.filter((h) => !NODE_HEADING_RE.test(h))) {
        findings.push({
          category: "registry-h3-external",
          message: `${an.name}: unregistered \`### \` heading(s): "${h}" — ${HEADING_KIND_RULE}`,
        });
      }

      // Digraph section content (mermaid-only + zero trailing prose).
      if (an.digraph.mermaid === null) {
        findings.push({
          category: "digraph-mermaid-missing",
          message: `${an.name}: \`${SECTION_HEADINGS.flowDigraph}\` carries no mermaid block — ${DIGRAPH_CONTENT_RULE}`,
        });
      } else if (an.digraph.trailing.trim() !== "") {
        findings.push({
          category: "digraph-prose-after-mermaid",
          message: `${an.name}: prose after the mermaid block ("${an.digraph.trailing.trim().split("\n")[0]}") — ${DIGRAPH_CONTENT_RULE}`,
        });
      }

      // Assertion 1 — bidirectional completeness.
      const nodeLabels = new Set(an.nodes.filter((n) => n.type === "rect").map((n) => n.label));
      const diamonds = new Set(an.nodes.filter((n) => n.type === "diamond").map((n) => n.label));
      for (const n of an.nodes.filter((n) => n.type === "rect" && !an.sections.includes(n.label))) {
        findings.push({
          category: "digraph-dangling-node",
          message: `${an.name}: dangling nodes without a \`### \`node\`\` definition: "${n.label}" (id=${n.id}) — ${NODE_DEFINITION_RULE}`,
        });
      }
      for (const s of an.sections.filter((s) => !nodeLabels.has(s) && !diamonds.has(s))) {
        findings.push({
          category: "digraph-orphan-section",
          message: `${an.name}: orphan \`### \` sections with no digraph node: \`${s}\` — ${NODE_DEFINITION_RULE}`,
        });
      }

      // Node four-element contract.
      for (const { name, block } of an.blocks) {
        for (const [field, re] of Object.entries(ELEMENT_PATTERNS)) {
          if (!re.test(block)) {
            findings.push({
              category: `node-missing-${field}`,
              message: `${an.name}: node \`${name}\` missing its **${field}:** element — ${NODE_ELEMENT_RULE}`,
            });
          }
        }
      }

      // Skeleton discipline — no standalone Rules / Red Flags sections.
      if (/^#{1,2} Rules$/m.test(an.src)) {
        findings.push({
          category: "standalone-rules",
          message: `${an.name}: found standalone "## Rules" heading`,
        });
      }
      if (/^#{1,2} Red Flags$/m.test(an.src)) {
        findings.push({
          category: "standalone-red-flags",
          message: `${an.name}: found standalone "## Red Flags" heading`,
        });
      }

      // Assertion 2 (skeleton isomorphism) — only the deltas-table carriers join the family.
      if (SECTION_HEADING_LINE.skeletonDeltas.test(an.src)) {
        findings.push(...skeletonIsomorphismFindings(an, ESCAPED_HEADING));
      }
    }

    // Assertion 2 family guard — every spec-writer MUST carry the deltas table.
    const withTables = new Set(
      analyzed
        .filter(({ an }) => SECTION_HEADING_LINE.skeletonDeltas.test(an.src))
        .map(({ an }) => an.name),
    );
    for (const s of SKELETON_TRIO.filter((s) => !withTables.has(s))) {
      findings.push({
        category: "skeleton-deltas-missing",
        message: `spec-writer(s) missing the Skeleton deltas table: ${s} — ${REGISTRY_RULE}`,
      });
    }

    // Assertion 3 — growth signal + consumer purity. Per-skill counts (printed into the output).
    const counts = analyzed.map(({ skill, an }) => {
      const edgeKeys = new Set(an.edges.map((e) => `${e.from}|${e.label}|${e.to}`));
      return { name: skill.name, nodes: an.nodes.length, edges: edgeKeys.size };
    });
    console.log("");
    console.log(
      `[digraph growth report] per-skill node/edge counts ` +
        `(boundary: >${GROWTH_NODE_LIMIT} nodes or >${GROWTH_EDGE_LIMIT} edges → rationale must be registered ` +
        `in the skill-anatomy schema growth registry; SKILL.md consumer surface keeps zero traces)`,
    );
    for (const c of counts) {
      const crosses = c.nodes > GROWTH_NODE_LIMIT || c.edges > GROWTH_EDGE_LIMIT;
      console.log(
        `  ${c.name}: ${c.nodes} nodes · ${c.edges} edges — ${crosses ? "CROSSES BOUNDARY" : "OK"}`,
      );
    }

    for (const c of counts) {
      if (c.nodes > GROWTH_NODE_LIMIT || c.edges > GROWTH_EDGE_LIMIT) {
        if (!REGISTERED_CROSSINGS.includes(c.name)) {
          findings.push({
            category: "growth-crossing-unregistered",
            message:
              `${c.name}: digraph (${c.nodes} nodes · ${c.edges} edges) crosses the growth boundary ` +
              `(${GROWTH_NODE_LIMIT} nodes / ${GROWTH_EDGE_LIMIT} edges) — its rationale must be registered ` +
              `in the skill-anatomy schema growth registry (crossings map); missing → FAIL — ${GROWTH_RULE}`,
          });
        }
      }
    }
    for (const { an } of analyzed) {
      for (const re of FORBIDDEN_HEADS) {
        if (re.test(an.src)) {
          findings.push({
            category: "consumer-purity-heading",
            message:
              `${an.name}: consumer surface purity — the SKILL.md may not carry a growth/refactor narrative ` +
              `heading (found "${re.source}"); the rationale lives in the skill-anatomy schema growth ` +
              `registry, and the consumer surface carries zero trace — ${PURITY_RULE}`,
          });
        }
      }
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // checkResidue(targets?, faces?) — the G2 cursor binary-name live-face collector
  // -------------------------------------------------------------------------

  /** checkResidue(targets?, faces?) — the G2 live-face last-index guard. The scan token, the
   *  data-source basenames, and the lexicon↔registry mirror all come from the lexicon data rows
   *  (data-derived allowance, never a hand-written exemption list); targetsOverride / facesOverride
   *  follow the existing collector injection pattern for tests. */
  checkResidue(targetsOverride?: string[], facesOverride?: ResidueFace[]): ResidueFinding[] {
    const token = this.#lexicon.residue.bannedToken;
    const tokenRe = new RegExp(token);
    const tokenQuoted = `"${token}"`;
    const dataSources = this.#lexicon.residue.dataSources;
    const faces: ResidueFace[] = targetsOverride
      ? [{ targets: targetsOverride, includeTests: true }]
      : (facesOverride ?? G2_LIVE_FACES);
    const hits: ResidueFinding[] = [];
    for (const { targets, includeTests } of faces) {
      for (const { file, lineNo, text } of scanLines(targets, tokenRe, { includeTests })) {
        if (isDataRow(dataSources, file, text, tokenQuoted)) continue; // data-source data row (the release form)
        hits.push({
          label: "cursor binary-name live-face residue (G2 zero-exemption)",
          file: `${file}:${lineNo}`,
        });
      }
    }

    // The lexicon is a mirror of the harness registry data (single-source rule): the clis mapping
    // must equal the registry cli values, and the residue ban token must equal the cursor mirror.
    const registry = JSON.parse(readFileSync(this.#registryPath, "utf8")) as Record<
      string,
      { cli?: string }
    >;
    const registryKeys = new Set(Object.keys(registry));
    for (const id of this.#lexicon.harness.ids) {
      if (!registryKeys.has(id)) {
        hits.push({
          label: `lexicon harness id ${id} missing from the harness registry (mirror drift)`,
          file: "packages/cdd-engine/src/infra/harness-registry.json",
        });
      }
    }
    for (const [id, cli] of Object.entries(this.#lexicon.harness.clis)) {
      if (registry[id]?.cli !== cli) {
        hits.push({
          label: `lexicon clis mapping ${id}=${cli} diverges from the registry cli data value (mirror drift)`,
          file: "packages/cdd-engine/src/infra/harness-registry.json",
        });
      }
    }
    if (this.#lexicon.residue.bannedToken !== this.#lexicon.harness.clis.cursor) {
      hits.push({
        label: "lexicon residue ban token diverges from the harness clis mirror",
        file: "packages/cdd-engine/src/infra/contract-lexicon.json",
      });
    }
    return hits;
  }

  // -------------------------------------------------------------------------
  // checkWording(skills?) — the C7 shape-restate guard
  // -------------------------------------------------------------------------

  /** checkWording(skills?) — the C7 wording guard: orchestrator skills keep zero engine-shape
   *  restate. The banned shape names (the old-stdout special-name literals — `3-line return
   *  block` / `4th line counters` / bare `return block`) come from the lexicon's stdout domain;
   *  modern contract referents (`output contract` / `handoff` / `findings`) and standalone
   *  `counters` (absorbed into the handoff namespace) are deliberately not in the set. The scan
   *  covers the full file (the safety net beyond the plan's known hit surface). */
  checkWording(skills?: string[]): WordingFinding[] {
    if (!skills || skills.length === 0) return [];
    const banned = this.#lexicon.stdout.bannedShapeNames;
    const combined = new RegExp(banned.map((s) => escapeRegExp(s)).join("|"));
    const hits: WordingFinding[] = [];
    for (const { file, lineNo, text } of scanLines(skills, combined)) {
      const matched = banned.filter((shape) => new RegExp(escapeRegExp(shape)).test(text));
      // The bare `return block` rule is subsumed by the `3-line return block` special name on the
      // same line (the dedicated fail name wins; the bare form targets unqualified use only).
      const names =
        matched.includes("3-line return block") && matched.includes("return block")
          ? matched.filter((n) => n !== "return block")
          : matched;
      hits.push({
        label: `engine-shape restate on the orchestrator surface (C7): ${names.join(", ")}`,
        file,
        line: lineNo,
      });
    }
    return hits;
  }

  // -------------------------------------------------------------------------
  // checkConfig(engineConfig?) — the engine-config channel audit
  // -------------------------------------------------------------------------

  /** checkConfig(engineConfig?) — the engine-config channel audit (the context.test assertion
   *  surface): the canonical env-channel whitelist is EXACTLY the four host-marker keys
   *  (AI_AGENT / CLAUDE_CODE_SESSION_ID / CURSOR_TRACE_ID + PATH — the host-detection closure),
   *  and the canonical timeout defaults are present. The input is the parsed context-contract
   *  section (channels / timeouts at the top — the loadContract face the migrated context.test
   *  consumed); the omitted-argument default loads engine-config.json and reads its contextContract
   *  section. */
  checkConfig(engineConfig?: Record<string, unknown>): ConfigFinding[] {
    const cfg: Record<string, unknown> | undefined =
      engineConfig ??
      (
        JSON.parse(
          readFileSync(path.join(ROOT, "packages/cdd-engine/templates/engine-config.json"), "utf8"),
        ) as { contextContract?: Record<string, unknown> }
      ).contextContract;
    const ctx = cfg as {
      channels?: { env?: Record<string, unknown> };
      timeouts?: { defaults?: Record<string, number> };
    };
    const hits: ConfigFinding[] = [];

    const envKeys = Object.values(ctx.channels?.env ?? {}).flatMap((v: Record<string, unknown>) =>
      typeof v.var === "string" ? [v.var] : Array.isArray(v.markers) ? v.markers : [],
    );
    const pinned = ["AI_AGENT", "CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "PATH"];
    if (JSON.stringify([...envKeys].sort()) !== JSON.stringify([...pinned].sort())) {
      hits.push({
        label: `engine-config env-channel whitelist ${JSON.stringify([...envKeys].sort())} ≠ pinned 4 keys ${JSON.stringify(pinned)} (host-marker closure broken)`,
        file: "packages/cdd-engine/templates/engine-config.json",
      });
    }
    const defaults = ctx.timeouts?.defaults ?? {};
    // T9 budget-dimension unification: the canonical budgets are keyed by DISPATCH OP
    // (implement 6h / review 3h / fix 6h) — the legacy `task` key is deleted with the config;
    // the three ops are the budget dimension's key set (same currency the dispatch islands wire,
    // task.ts / docs.ts / branch.ts resolving by their actual op).
    if (defaults.implement !== 21_600_000) {
      hits.push({
        label: `engine-config timeout defaults.implement ${defaults.implement} ≠ 21600000 (canonical drift)`,
        file: "packages/cdd-engine/templates/engine-config.json",
      });
    }
    if (defaults.review !== 10_800_000) {
      hits.push({
        label: `engine-config timeout defaults.review ${defaults.review} ≠ 10800000 (canonical drift)`,
        file: "packages/cdd-engine/templates/engine-config.json",
      });
    }
    if (defaults.fix !== 21_600_000) {
      hits.push({
        label: `engine-config timeout defaults.fix ${defaults.fix} ≠ 21600000 (canonical drift)`,
        file: "packages/cdd-engine/templates/engine-config.json",
      });
    }
    return hits;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Assertion 2 (skeleton isomorphism) findings for one deltas-table carrier: the shared
 *  review-loop/commit/handoff skeleton shape + the two registered deltas rows. */
function skeletonIsomorphismFindings(
  an: AnalyzedSkill,
  escapedHeading: Record<string, string>,
): AnatomyFinding[] {
  const out: AnatomyFinding[] = [];
  const nodesById = new Map(an.nodes.map((n) => [n.id, n]));
  const edgeExists = (fromLabel: string, toLabel: string | RegExp, edgeLabel: string): boolean =>
    an.edges.some((e) => {
      const s = nodesById.get(e.from);
      const d = nodesById.get(e.to);
      if (!s || !d || s.label !== fromLabel) return false;
      const dstOk = toLabel instanceof RegExp ? toLabel.test(d.label) : d.label === toLabel;
      if (!dstOk) return false;
      return edgeLabel === "" || e.label === edgeLabel;
    });
  const name = an.name;
  const skeletonChecks: Array<[string, boolean]> = [
    [
      "spec-review node missing",
      an.nodes.some((n) => n.type === "rect" && n.label === "spec-review"),
    ],
    [
      "status? decision missing",
      an.nodes.some((n) => n.type === "diamond" && n.label === "status?"),
    ],
    ["fix-spec node missing", an.nodes.some((n) => n.type === "rect" && n.label === "fix-spec")],
    [
      "commit-spec node missing",
      an.nodes.some((n) => n.type === "rect" && n.label === "commit-spec"),
    ],
    [
      "handoff-* node missing",
      an.nodes.some((n) => n.type === "rect" && /^handoff-/.test(n.label)),
    ],
    ["spec-review → status? edge missing", edgeExists("spec-review", "status?", "")],
    // C1 status-routing canon: `{status?}` fires the convergence fork — CHANGES_REQUESTED /
    // REVIEW_FIX route to fix-spec (one compound edge), APPROVED straight to commit-spec (S3 —
    // zero findings, no fix dispatch); the fix-spec exit returns to spec-review (S1 — re-review
    // mandatory after the fix) or proceeds to commit-spec (S2 — closing round, no re-review).
    ["status? → fix-spec edge missing", edgeExists("status?", "fix-spec", "")],
    [
      "status? --APPROVED--> commit-spec bypass edge missing (S3 — zero findings, no fix dispatch)",
      edgeExists("status?", "commit-spec", "APPROVED"),
    ],
    [
      "fix-spec --entered via CHANGES_REQUESTED--> spec-review back-edge missing (S1 — re-review mandatory after the fix)",
      edgeExists("fix-spec", "spec-review", "entered via CHANGES_REQUESTED"),
    ],
    [
      "fix-spec --entered via REVIEW_FIX--> commit-spec edge missing (S2 — closing round, no re-review)",
      edgeExists("fix-spec", "commit-spec", "entered via REVIEW_FIX"),
    ],
    ["commit-spec → handoff-* edge missing", edgeExists("commit-spec", /^handoff-/, "")],
  ];
  for (const [desc, ok] of skeletonChecks) {
    if (!ok) out.push({ category: "skeleton-shape", message: `${name}: ${desc}` });
  }

  // Skeleton deltas table — handoff delta registered + shared-loop shape declared.
  const rows = skeletonDeltaRows(an.src, escapedHeading);
  const observedHandoff = an.nodes.find(
    (n) => n.type === "rect" && /^handoff-/.test(n.label),
  )?.label;
  const handoffRow = rows.find((r) => r.key.toLowerCase().includes("handoff"));
  if (!handoffRow) {
    out.push({
      category: "skeleton-shape",
      message: `${name}: Skeleton deltas table has no "handoff-spec" row (unregistered handoff)`,
    });
  } else {
    const declared = handoffRow.value.match(/`([^`]+)`/);
    if (!declared) {
      out.push({
        category: "skeleton-shape",
        message: `${name}: handoff-spec row declares no backticked node name`,
      });
    } else if (declared[1] !== observedHandoff) {
      out.push({
        category: "skeleton-shape",
        message: `${name}: digraph handoff node "${observedHandoff}" differs from the registered "${declared[1]}" (update the Skeleton deltas table)`,
      });
    }
  }
  const loopRow = rows.find((r) => r.key.toLowerCase().includes("review loop"));
  if (!loopRow) {
    out.push({
      category: "skeleton-shape",
      message: `${name}: Skeleton deltas table has no "review loop" row — the shared skeleton must be declared`,
    });
  } else if (!/shared shape|no delta/i.test(loopRow.value)) {
    out.push({
      category: "skeleton-shape",
      message: `${name}: review-loop row does not declare the shared shape ("${loopRow.value}")`,
    });
  }
  return out;
}

/** Skeleton-deltas table rows: `| cell | cell |` between the Skeleton deltas heading and the next
 *  `## ` — parsed through the schema-registered heading constant, never a hard-coded literal. */
function skeletonDeltaRows(src: string, escapedHeading: Record<string, string>) {
  const m = src.match(new RegExp(`${escapedHeading.skeletonDeltas}\n([\\s\\S]*?)(?=\n## )`));
  if (!m) return [];
  const rows: Array<{ key: string; value: string }> = [];
  const rowRe = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
  for (let r = rowRe.exec(m[1]); r !== null; r = rowRe.exec(m[1])) {
    rows.push({ key: r[1].trim(), value: r[2].trim() });
  }
  return rows;
}
