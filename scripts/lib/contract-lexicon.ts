// scripts/lib/contract-lexicon.ts — the CDD contract-lexicon guard (C6, P3 T4). ONE class drives
// the converged check faces the plan pinned: the skill-anatomy assertions (checkAnatomy — the
// digraph-consistency surface), the G2 cursor binary-name live-face residue collector
// (checkResidue — the former collectCursorAgentHits), the C7 shape-restate wording guard
// (checkWording — orchestrator skills keep zero engine-shape special-name literals), the
// engine-config channel audit (checkConfig — the former context.test channel assertions), and the
// four-direction harness-contract guard (checkHarness — P4 C8: detect ↔ the harness.ts detect()
// predicates ↔ the engine-config env whitelist, refs ↔ SKILL text dual forms, prefix derivation ↔
// the actual injected forms, install ↔ the README upstream dependency table; checkMarkers folds
// into its detect direction). The class reads the guards-family lexicon (scripts/lib/
// guard-lexicon.json — the repository-verification word tables: the scan token / data-row
// basenames / banned shape names), the engine command lexicon (packages/cdd-engine/config/
// contract-lexicon.json — the command + schema facts: the read-back wording / the anatomy
// reference) and the harness contract (config/harness-contract.json — the unique harness
// contract, C8) as its data sources: never a hand-written allowlist — a behavior change goes
// through the data, not through this file.
//
// Criterion ②: the guard surface is instance methods, zero bare-function exports (module-private
// helpers stay private). The guarded binary-name lexeme is CARRIED by the lexicon data rows, so
// this guard body never holds the lexeme contiguously — a live face (scripts/) must not become a
// carrier of the vocabulary it guards (the scripts face scan sits in the same G2 sweep).
// C7: the data-source paths derive from the engine locator table (RESOURCE_SPECS — the single
// path truth), never a second literal path list.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveResourceSrc } from "../../packages/cdd-engine/src/infra/resource.ts";
import {
  escapeRegExp,
  isDataRow,
  isPlanPinDataFile,
  isSpecVerbatimPinLine,
  scanLines,
  walkTargetFiles,
} from "./scan.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

// The guard lexicon (scripts/lib/guard-lexicon.json) is the guards-family data source — the
// repository-verification vocabulary (residue / escape / zero-debt / buildability / banned-shape
// words). The engine contract vocabulary (the command + schema families — the read-back wording /
// the anatomy schema reference) lives in the engine word table (config/contract-lexicon.json) and
// is read as the command data source; the two files use the governance/machine vocabularies
// (word-authority split).
const DEFAULT_GUARD_LEXICON_PATH = path.join(HERE, "guard-lexicon.json");
const DEFAULT_COMMAND_LEXICON_PATH = resolveResourceSrc(
  "contract-lexicon",
  path.join(HERE, "..", "..", "packages/cdd-engine", "src"),
);
const DEFAULT_REGISTRY_PATH = resolveResourceSrc(
  "harness-contract",
  path.join(HERE, "..", "..", "packages/cdd-engine", "src"),
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

export interface MarkerFinding {
  label: string;
  file: string;
}

export interface LexiconMarker {
  /** The host-marker env key the harness detect() predicate reads. */
  env: string;
  /** claude-only: the AI_AGENT prefix the detect() predicate matches via startsWith. */
  aiAgentPrefix?: string;
  /** pi-only: the AI_AGENT exact value the detect() predicate matches (=== "value"). */
  value?: string;
}

/** The guard-lexicon data shape (scripts/lib/guard-lexicon.json — the guards family): the
 *  repository-verification word tables. Machine-token leaves are arrays (tokens / dataSources);
 *  wording leaves are plain strings (wording / evidenceWording). */
interface GuardLexiconData {
  _doc: string;
  guards: {
    residue: { dataSources: string[]; tokens: string[]; wording: string };
    escape: { tokens: string[]; wording: string };
    zeroDebt: { tokens: string[]; wording: string };
    buildability: { evidenceWording: string; wording: string };
    wording: { tokens: string[]; wording: string };
  };
}

/** The engine contract-word data shape (config/contract-lexicon.json — the command + schema
 *  families): the status vocabulary / dual axes, the capsule + route tokens, the read-back wording
 *  the engine emits on the review `next:` line, and the skill-anatomy schema reference. */
interface CommandLexiconData {
  _doc: string;
  command: {
    status: { vocab: string[]; axes: { judgment: string[]; work: string[] } };
    capsule: { tokens: string[]; readbackWording: string };
    route: { routeTokens: string[]; stations: Record<string, string> };
  };
  schema: { anatomy: { schemaPath: string; skillsRoot: string } };
}

/** The harness-contract row shape (config/harness-contract.json — C8): the per-harness row data
 *  the guard's harness-side directions read (detect rows / install banners / the dispatch + refs
 *  tables at the top level). */
interface HarnessContract {
  detect?: LexiconMarker;
  install?: Record<string, string[]>;
  dispatch?: Record<string, unknown>;
  refs?: Record<string, Record<string, string>>;
  [key: string]: unknown;
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

// The zero-debt source faces — the escape-directive zero-hit and the whole-repo source-plane
// prebuilt-module zero-hit ride ONE face set (engine src · scripts · kairos tests · the
// engine-config data plane · the migrated source-config plane); the product face (the engine's
// dist/ tree) is deliberately outside the set — it ships the built artifacts. Dispositions follow
// the G2 doctrine: engine src scans its test sites (the T1/T2 zeroing held there too), scripts
// self-exempts its __tests__ (the guard's own regression-test position), the kairos tests face is
// a test surface scanned in full, the two config faces have no test sites. The last face pins the
// T3-migrated source-config plane (root/engine vitest.config.ts + lint-staged.config.ts) — the
// exact files the whole-repo .mjs→.ts migration moved; a deleted or renamed config target surfaces
// as a missing-target guard failure, never a silent pass.
export const ZERO_DEBT_FACES: ResidueFace[] = [
  { targets: ["packages/cdd-engine/src"], includeTests: true },
  { targets: ["scripts"], includeTests: false },
  { targets: ["packages/kairos/tests"], includeTests: true },
  { targets: ["packages/cdd-engine/config"], includeTests: false },
  {
    targets: ["vitest.config.ts", "packages/cdd-engine/vitest.config.ts", "lint-staged.config.ts"],
    includeTests: false,
  },
];

// The docs-face live grep gate target set (T7): the docs faces of the constraint's live-face
// definition (CLAUDE.md · the deps ledger · the engine README pair), scanned with the SAME
// escape/retired token set via checkEscape(facesOverride). Together with the ZERO_DEBT_FACES scan
// (the source/config faces) the two gates are the complete live face.
export const DOC_ESCAPE_FACES: ResidueFace[] = [
  {
    targets: [
      "CLAUDE.md",
      "docs/maintainers/05-third-party-dependencies.md",
      "packages/cdd-engine/README.md",
      "packages/cdd-engine/README.zh-CN.md",
    ],
    includeTests: false,
  },
];

// ---------------------------------------------------------------------------
// skill-anatomy parsing — the digraph-consistency assertion port. All structure facts come from
// the canonical skill-anatomy schema (single source, never a hard-coded structure literal); the
// lexicon's anatomy domain carries the schema path.
// ---------------------------------------------------------------------------

/** The skill-anatomy schema surface checkAnatomy reads (the structure contract it asserts). The
 *  JSON data itself is loaded at the JSON.parse boundary in checkAnatomy. */
interface AnatomySchema {
  properties: {
    sectionRegistry: {
      description: string;
      properties: {
        public: { items: { enum: string[] } };
        conditional: { items: { enum: string[] } };
        headingKinds: { description: string; properties: { nodeName: { pattern: string } } };
        sections: {
          properties: Record<
            string,
            {
              properties: {
                heading: { const: string };
                requiredCarriers?: { items: { enum: string[] } };
              };
            }
          >;
        };
      };
    };
    digraph: { properties: { mermaidOnly: { description: string } } };
    nodeElements: { description: string; properties: Record<string, { pattern: string }> };
    nodeDefinitions: { description: string };
    growthBoundary: {
      description: string;
      properties: {
        nodeLimit: { const: number };
        edgeLimit: { const: number };
        registry: {
          properties: { crossings: { properties: Record<string, unknown> } };
        };
      };
    };
    consumerPurity: {
      description: string;
      properties: { forbiddenNarrativeHeads: { items: { enum: string[] } } };
    };
  };
}

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
 * harness contract it mirrors) load from the repo source single. `lexiconPath` / `registryPath`
 * injection lets tests drive the guard against temp data sources.
 */
export class ContractLexiconGuard {
  readonly #lexicon: GuardLexiconData;
  readonly #commandLexicon: CommandLexiconData;
  readonly #contractPath: string;
  #contract: HarnessContract | null = null;

  constructor(
    opts: {
      /** The guards-family lexicon path. Default: scripts/lib/guard-lexicon.json. */
      guardLexiconPath?: string;
      /** The engine command+schema lexicon path. Default: the engine config contract-lexicon.json
       *  via the locator table. */
      commandLexiconPath?: string;
      registryPath?: string;
    } = {},
  ) {
    this.#lexicon = JSON.parse(
      readFileSync(opts.guardLexiconPath ?? DEFAULT_GUARD_LEXICON_PATH, "utf8"),
    ) as GuardLexiconData;
    this.#commandLexicon = JSON.parse(
      readFileSync(opts.commandLexiconPath ?? DEFAULT_COMMAND_LEXICON_PATH, "utf8"),
    ) as CommandLexiconData;
    this.#contractPath = opts.registryPath ?? DEFAULT_REGISTRY_PATH;
    // Inline shape validation — the guards-family data plane is a closed shape (missing/illegal
    // fields fail loud at construction, never drift silently into a hollow check).
    this.#validateShape();
  }

  #validateShape(): void {
    const fail = (what: string): never => {
      throw new Error(`guard lexicon shape violation: ${what}`);
    };
    const requireStrings = (v: unknown, domain: string, field: string): void => {
      if (!Array.isArray(v) || v.length === 0 || v.some((x) => typeof x !== "string"))
        fail(`${domain}.${field} must be a non-empty string array`);
    };
    const requireString = (v: unknown, domain: string, field: string): void => {
      if (typeof v !== "string" || v.length === 0)
        fail(`${domain}.${field} must be a non-empty string`);
    };
    if (typeof this.#lexicon.guards !== "object" || this.#lexicon.guards === null)
      fail("guards must be an object");
    const g = this.#lexicon.guards;
    requireStrings(g.residue.dataSources, "guards.residue", "dataSources");
    requireStrings(g.residue.tokens, "guards.residue", "tokens");
    requireString(g.residue.wording, "guards.residue", "wording");
    requireStrings(g.escape.tokens, "guards.escape", "tokens");
    requireString(g.escape.wording, "guards.escape", "wording");
    requireStrings(g.zeroDebt.tokens, "guards.zeroDebt", "tokens");
    requireString(g.zeroDebt.wording, "guards.zeroDebt", "wording");
    requireString(g.buildability.evidenceWording, "guards.buildability", "evidenceWording");
    requireString(g.buildability.wording, "guards.buildability", "wording");
    requireStrings(g.wording.tokens, "guards.wording", "tokens");
    requireString(g.wording.wording, "guards.wording", "wording");
    if (
      typeof this.#commandLexicon.command !== "object" ||
      this.#commandLexicon.command === null ||
      typeof this.#commandLexicon.schema !== "object" ||
      this.#commandLexicon.schema === null
    )
      fail("command and schema must be objects");
    const c = this.#commandLexicon.command;
    requireStrings(c.status.vocab, "command.status", "vocab");
    requireStrings(c.status.axes.judgment, "command.status.axes", "judgment");
    requireStrings(c.status.axes.work, "command.status.axes", "work");
    requireStrings(c.capsule.tokens, "command.capsule", "tokens");
    requireString(c.capsule.readbackWording, "command.capsule", "readbackWording");
    requireStrings(c.route.routeTokens, "command.route", "routeTokens");
    if (typeof c.route.stations !== "object" || c.route.stations === null)
      fail("command.route.stations must be an object");
    requireString(this.#commandLexicon.schema.anatomy.schemaPath, "schema.anatomy", "schemaPath");
    requireString(this.#commandLexicon.schema.anatomy.skillsRoot, "schema.anatomy", "skillsRoot");
  }

  /** The loaded guards-family lexicon (the repository-verification word tables; test/assertion
   *  surfaces read the same data the guard reads). */
  lexicon(): GuardLexiconData {
    return this.#lexicon;
  }

  /** The loaded engine command+schema lexicon (the status vocabulary / capsule + route tokens /
   *  read-back wording / anatomy reference — the engine-contract facts). */
  commandLexicon(): CommandLexiconData {
    return this.#commandLexicon;
  }

  /** The loaded harness contract (config/harness-contract.json — the unique harness contract the
   *  harness-side directions read; lazy, so tests injecting a registry path get the injected data). */
  contract(): HarnessContract {
    if (!this.#contract) {
      this.#contract = JSON.parse(readFileSync(this.#contractPath, "utf8")) as HarnessContract;
    }
    return this.#contract;
  }

  // -------------------------------------------------------------------------
  // checkAnatomy(skills?) — the digraph-consistency assertion surface
  // -------------------------------------------------------------------------

  #discoverSkills(): AnatomySkill[] {
    const root = path.join(ROOT, this.#commandLexicon.schema.anatomy.skillsRoot);
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
   *  P6 E1 flow atomicity; the migration target of packages/kairos/tests/
   *  digraph-consistency.test.mjs). Every structure literal reads from the skill-anatomy schema
   *  (the lexicon's anatomy domain pins its path); skillsOverride lets tests inject temp skills.
   *  The growth report prints to stdout (the validate block's output face, same as the retired
   *  test); the return value is the aggregated findings list (empty = pass). */
  checkAnatomy(skillsOverride?: AnatomySkill[]): AnatomyFinding[] {
    const schemaPath = path.isAbsolute(this.#commandLexicon.schema.anatomy.schemaPath)
      ? this.#commandLexicon.schema.anatomy.schemaPath
      : path.join(ROOT, this.#commandLexicon.schema.anatomy.schemaPath);
    // JSON.parse boundary: the canonical skill-anatomy schema document (its structure contract).
    const ANATOMY = JSON.parse(readFileSync(schemaPath, "utf8")) as AnatomySchema;

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
      Object.entries(reg.sections.properties).map(([key, node]): [string, string] => [
        key,
        node.properties.heading.const,
      ]),
    );
    const ESCAPED_HEADING = Object.fromEntries(
      Object.entries(SECTION_HEADINGS).map(([key, h]): [string, string] => [key, escapeRegExp(h)]),
    );
    const SECTION_HEADING_LINE = Object.fromEntries(
      Object.entries(ESCAPED_HEADING).map(([key, h]): [string, RegExp] => [
        key,
        new RegExp(`^${h}$`, "m"),
      ]),
    );
    const CONDITIONAL_CARRIERS = Object.fromEntries(
      CONDITIONAL_SECTION_KEYS.map((key): [string, string[]] => {
        const carriers = reg.sections.properties[key].properties.requiredCarriers;
        // The schema requires requiredCarriers on its conditional sections — a missing one is
        // schema drift the guard must fail loud on, never carry forward as an empty set.
        if (carriers === undefined) {
          throw new Error(
            `skill-anatomy schema: conditional section ${key} missing requiredCarriers`,
          );
        }
        return [key, carriers.items.enum];
      }),
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
      Object.entries(ANATOMY.properties.nodeElements.properties).map(
        ([key, node]): [string, RegExp] => [key, new RegExp(node.pattern, "m")],
      ),
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
   *  data-source basenames come from the lexicon data rows (data-derived allowance, never a
   *  hand-written exemption list); targetsOverride / facesOverride follow the existing collector
   *  injection pattern for tests. C8: the former lexicon↔registry mirror-pair checks are deleted —
   *  the harness contract is the unique harness-data source (the lexicon keeps the pure word
   *  tables), so no mirror drift surface remains. */
  checkResidue(targetsOverride?: string[], facesOverride?: ResidueFace[]): ResidueFinding[] {
    const tokens = this.#lexicon.guards.residue.tokens;
    const dataSources = this.#lexicon.guards.residue.dataSources;
    const faces: ResidueFace[] = targetsOverride
      ? [{ targets: targetsOverride, includeTests: true }]
      : (facesOverride ?? G2_LIVE_FACES);
    const hits: ResidueFinding[] = [];
    for (const { targets, includeTests } of faces) {
      for (const token of tokens) {
        const tokenRe = new RegExp(escapeRegExp(token));
        const tokenQuoted = `"${token}"`;
        for (const { file, lineNo, text } of scanLines(targets, tokenRe, { includeTests })) {
          if (isSpecVerbatimPinLine(file, lineNo) || isPlanPinDataFile(file)) continue; // pin data line
          if (isDataRow(dataSources, file, text, tokenQuoted)) continue; // data-source data row (the release form)
          hits.push({
            label: "cursor binary-name live-face residue (G2 zero-exemption)",
            file: `${file}:${lineNo}`,
          });
        }
      }
    }
    return hits;
  }

  // -------------------------------------------------------------------------
  // checkEscape(faces?) / checkMjs(faces?) — the T5 zero-debt source faces
  // -------------------------------------------------------------------------

  /** checkEscape(faces?) — the escape/retired-token zero-hit (T5 + T7): the two TypeScript escape
   *  directives plus the retired zero-build toolchain tokens (token set from the lexicon's escape
   *  domain, never a literal in this body — the guard must not become a carrier) settle to zero
   *  across the zero-debt source faces (ZERO_DEBT_FACES — engine src · scripts · kairos tests ·
   *  engine config · the migrated source-config plane, the same face set the source-plane
   *  prebuilt-module zero-hit rides).
   *  The lexicon config file carries the tokens as data values — the shared data-row mask
   *  (isDataRow over the lexicon's residue dataSources) releases them; anything else on the source
   *  faces fails. The live docs face (CLAUDE.md · the deps ledger · the engine README pair) is
   *  covered by the T7 docs-face live grep gate in scripts/validate/residue.ts — it calls this
   *  same check with the docs target set, so the full six-token list rides both gates.
   *  facesOverride follows the collector injection pattern. */
  checkEscape(facesOverride?: ResidueFace[]): ResidueFinding[] {
    const dataSources = this.#lexicon.guards.residue.dataSources;
    const tokens = this.#lexicon.guards.escape.tokens;
    const faces = facesOverride ?? ZERO_DEBT_FACES;
    const hits: ResidueFinding[] = [];
    for (const { targets, includeTests } of faces) {
      for (const token of tokens) {
        const re = new RegExp(escapeRegExp(token));
        for (const { file, lineNo, text } of scanLines(targets, re, { includeTests })) {
          if (isSpecVerbatimPinLine(file, lineNo) || isPlanPinDataFile(file)) continue; // pin data line
          if (isDataRow(dataSources, file, text, `"${token}"`)) continue; // lexicon data-value release form
          hits.push({
            label: `escape/retired-token zero-hit violation (T5+T7 ban): ${token}`,
            file: `${file}:${lineNo}`,
          });
        }
      }
    }
    return hits;
  }

  /** checkMjs(faces?) — the whole-repo source-plane prebuilt-module zero-hit (T5 residue-target
   *  upgrade): the prebuilt-module extension (token from the lexicon's zeroDebt domain) settles to
   *  zero across the zero-debt source faces (ZERO_DEBT_FACES — engine src · scripts · kairos tests
   *  · engine config · the migrated source-config plane). The check is file-extension based
   *  (walkTargetFiles), never a content scan — a comment mention stays legal, a file of the
   *  banned extension on a source face fails. The product face (the engine's dist/ tree) is outside
   *  the face set and stays exempt — the published package ships real built artifacts there.
   *  facesOverride follows the collector injection pattern. */
  checkMjs(facesOverride?: ResidueFace[]): ResidueFinding[] {
    const extTokens = this.#lexicon.guards.zeroDebt.tokens;
    const faces = facesOverride ?? ZERO_DEBT_FACES;
    const hits: ResidueFinding[] = [];
    for (const { targets, includeTests } of faces) {
      for (const abs of walkTargetFiles(targets, { includeTests })) {
        if (extTokens.some((ext) => abs.endsWith(ext))) {
          hits.push({
            label:
              "source-plane prebuilt-module residue (T5: the plane is all typed sources; the product dist tree excluded)",
            file: path.relative(ROOT, abs),
          });
        }
      }
    }
    return hits;
  }

  // -------------------------------------------------------------------------
  // checkWording(skills?) — the C7 shape-restate guard
  // -------------------------------------------------------------------------

  /** checkWording(skills?) — the C7 wording guard + the T5 zero-debt restate guard: orchestrator
   *  skills keep zero engine-shape restate AND zero zero-debt vocabulary restate. The banned shape
   *  names (the old-stdout special-name literals — `3-line return block` / `4th line counters` /
   *  bare `return block`) come from the lexicon's stdout domain; the T5 zero-debt vocabulary (the
   *  escape directives / the prebuilt-module extension / the engine read-back annotation) comes
   *  from the lexicon's escape / zeroDebt / stdout domains (data-derived, never a literal in this
   *  body). Modern contract referents (`output contract` / `handoff` / `findings`) and standalone
   *  `counters` (absorbed into the handoff namespace) are deliberately not in the set; the
   *  read-back annotation rides the actual engine command output (T6 wires it onto the `next:`
   *  line), so the skill surface keeps zero literal restates (the T5 restate decision). The scan
   *  covers the full file (the safety net beyond the plan's known hit surface). */
  checkWording(skills?: string[]): WordingFinding[] {
    if (!skills || skills.length === 0) return [];
    return [
      ...this.#wordingScan(
        skills,
        this.#lexicon.guards.wording.tokens,
        "engine-shape restate on the orchestrator surface (C7)",
      ),
      ...this.#wordingScan(
        skills,
        this.#zeroDebtBannedTokens(),
        "zero-debt restate on the orchestrator surface (T5)",
      ),
    ];
  }

  /** The zero-debt ban set checkWording asserts on the orchestrator skills (T5): the escape
   *  directives, the prebuilt-module extension, and the engine read-back annotation — sourced from
   *  the lexicon data, never a literal restate (the guard body is not a carrier). */
  #zeroDebtBannedTokens(): string[] {
    return [
      ...this.#lexicon.guards.escape.tokens,
      ...this.#lexicon.guards.zeroDebt.tokens,
      this.#commandLexicon.command.capsule.readbackWording,
    ];
  }

  /** One banned-word scan lane: line-level hits for a banned token set under a label kind. A
   *  matched token that is a substring of another matched token reports only the longer name (the
   *  dedicated fail name wins over its bare parent — data-derived, never a literal pair in this
   *  body). */
  #wordingScan(skills: string[], banned: string[], kind: string): WordingFinding[] {
    if (banned.length === 0) return [];
    const combined = new RegExp(banned.map((s) => escapeRegExp(s)).join("|"));
    const hits: WordingFinding[] = [];
    for (const { file, lineNo, text } of scanLines(skills, combined)) {
      const matched = banned.filter((shape) => new RegExp(escapeRegExp(shape)).test(text));
      const names = matched.filter((n) => !matched.some((m) => m !== n && m.includes(n)));
      hits.push({ label: `${kind}: ${names.join(", ")}`, file, line: lineNo });
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
    const cfg = loadConfigCtx(engineConfig);
    const ctx = cfg as {
      channels?: { env?: Record<string, unknown> };
      timeouts?: { defaults?: Record<string, number> };
    };
    const hits: ConfigFinding[] = [];

    const envKeys = configEnvKeys(ctx);
    const pinned = ["AI_AGENT", "CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "PATH"];
    if (JSON.stringify([...envKeys].sort()) !== JSON.stringify([...pinned].sort())) {
      hits.push({
        label: `engine-config env-channel whitelist ${JSON.stringify([...envKeys].sort())} ≠ pinned 4 keys ${JSON.stringify(pinned)} (host-marker closure broken)`,
        file: "packages/cdd-engine/config/engine-config.json",
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
        file: "packages/cdd-engine/config/engine-config.json",
      });
    }
    if (defaults.review !== 10_800_000) {
      hits.push({
        label: `engine-config timeout defaults.review ${defaults.review} ≠ 10800000 (canonical drift)`,
        file: "packages/cdd-engine/config/engine-config.json",
      });
    }
    if (defaults.fix !== 21_600_000) {
      hits.push({
        label: `engine-config timeout defaults.fix ${defaults.fix} ≠ 21600000 (canonical drift)`,
        file: "packages/cdd-engine/config/engine-config.json",
      });
    }
    return hits;
  }

  // -------------------------------------------------------------------------
  // checkMarkers(opts?) — the detect direction of the harness-contract guard
  // -------------------------------------------------------------------------

  /** checkMarkers(opts?) — the detect direction of the harness-contract guard (T3, re-homed by
   *  C8): the harness contract's per-row `detect` data must mirror BOTH the harness.ts detect()
   *  predicates (semantic presence — env key read / aiAgentPrefix startsWith / value === match —
   *  plus the bidirectional env-key closure) AND the engine-config env whitelist (detect env keys
   *  ∪ PATH — the host-marker closure). Drift on any face fires a finding. The detect face parses
   *  the live harness.ts source into class blocks and brace-balanced detect() bodies (`harnessSrc`
   *  override lets tests inject a broken predicate); the config face reads the same engine-config
   *  context-contract the channel audit consumes (loadConfigCtx, shared with checkConfig). */
  checkMarkers(
    opts: { harnessSrc?: string; engineConfig?: Record<string, unknown> } = {},
  ): MarkerFinding[] {
    return this.#checkHarnessDetect(opts);
  }

  // -------------------------------------------------------------------------
  // checkHarness(opts?) — the four-direction harness-contract guard (C8)
  // -------------------------------------------------------------------------

  /** checkHarness(opts?) — the four-direction harness-contract guard (C8): ① detect ↔ the
   *  harness.ts detect() predicates ↔ the engine-config env whitelist; ② refs ↔ the SKILL-text
   *  reference sites (every `<pkg>:<skill>` cross-skill reference must be a registered ref key and
   *  carry its pi dual form `（pi：/skill:<bare>）` — the zero-bare-ns pin); ③ prefix derivation ↔
   *  the actual per-harness injection forms (every dispatch slot resolves to a ref key that the
   *  refs table renders per harness — pi always `/skill:<bare>`, claude/cursor `/namespace:skill`);
   *  ④ install ↔ the README upstream dependency table (the user-provided install commands render
   *  verbatim from the install rows). checkMarkers is the detect direction's retained seam. */
  checkHarness(
    opts: {
      harnessSrc?: string;
      engineConfig?: Record<string, unknown>;
      skills?: AnatomySkill[];
      readmes?: string[];
    } = {},
  ): MarkerFinding[] {
    return [
      ...this.#checkHarnessDetect(opts),
      ...this.#checkHarnessRefs(opts),
      ...this.#checkHarnessPrefix(),
      ...this.#checkHarnessInstall(opts),
    ];
  }

  #checkHarnessDetect(opts: { harnessSrc?: string; engineConfig?: Record<string, unknown> } = {}) {
    const hits: MarkerFinding[] = [];
    const contract = this.contract();
    const rows = Object.entries(contract).filter(
      ([key, row]) => key !== "dispatch" && key !== "refs" && row && typeof row === "object",
    );
    const markers: Record<string, LexiconMarker> = {};
    for (const [id, row] of rows) {
      const detect = (row as { detect?: LexiconMarker }).detect;
      if (detect) markers[id] = detect;
    }
    const markerIds = Object.keys(markers);
    const harnessSrc =
      opts.harnessSrc ??
      readFileSync(path.join(ROOT, "packages/cdd-engine/src/infra/harness.ts"), "utf8");
    const classes = harnessClassesById(harnessSrc);

    // Identity closure — every harness class id carries a detect row and every detect row has a
    // class (a new harness class or a removed detect row is drift).
    const classIds = new Set(classes.keys());
    if (!setEqual(classIds, new Set(markerIds))) {
      hits.push({
        label: `detect ids ${JSON.stringify(markerIds)} ≠ harness.ts detect() classes ${JSON.stringify([...classIds].sort())} (host-marker identity closure broken)`,
        file: "packages/cdd-engine/src/infra/harness.ts",
      });
    }

    // Per-detect-row semantics vs the detect() predicate; the contract detect data is the single
    // source of the detect() env semantics — reversed, every env key the predicates read must be
    // declared.
    const declaredKeys = new Set<string>();
    const detectedKeys = new Set<string>();
    for (const id of markerIds) {
      const row = markers[id];
      if (row.env) declaredKeys.add(row.env);
      const classBody = classes.get(id)?.body;
      if (classBody === undefined) continue; // the identity-closure hit above names the gap
      const pred = detectPredicate(classBody);
      if (!pred) {
        hits.push({
          label: `harness class for detect row ${id} carries no detect() predicate body (detect row unverifiable)`,
          file: "packages/cdd-engine/src/infra/harness.ts",
        });
        continue;
      }
      const keys = envKeysUsed(pred.body, pred.paramName);
      for (const k of keys) detectedKeys.add(k);
      if (row.env && !keys.includes(row.env)) {
        hits.push({
          label: `detect ${id} env key ${row.env} not read by the detect() predicate`,
          file: "packages/cdd-engine/src/infra/harness.ts",
        });
      }
      if (row.aiAgentPrefix && !pred.body.includes(`startsWith("${row.aiAgentPrefix}")`)) {
        hits.push({
          label: `detect ${id} aiAgentPrefix ${row.aiAgentPrefix} absent from the detect() predicate`,
          file: "packages/cdd-engine/src/infra/harness.ts",
        });
      }
      if (row.value && !pred.body.includes(`=== "${row.value}"`)) {
        hits.push({
          label: `detect ${id} value ${row.value} absent from the detect() predicate`,
          file: "packages/cdd-engine/src/infra/harness.ts",
        });
      }
    }
    if (!setEqual(declaredKeys, detectedKeys)) {
      hits.push({
        label: `detect() env reads ${JSON.stringify([...detectedKeys].sort())} ≠ contract detect env ${JSON.stringify([...declaredKeys].sort())} (host-marker env-set drift)`,
        file: "packages/cdd-engine/src/infra/harness.ts",
      });
    }

    // The config face — the env whitelist is the host-marker closure: detect env keys ∪ PATH,
    // neither larger nor smaller (the 4-key pin lives here; checkConfig pins the same set).
    const whitelisted = [...configEnvKeys(loadConfigCtx(opts.engineConfig))].sort();
    const expected = [...new Set([...declaredKeys, "PATH"])].sort();
    if (JSON.stringify(whitelisted) !== JSON.stringify(expected)) {
      hits.push({
        label: `engine-config env whitelist ${JSON.stringify(whitelisted)} ≠ detect keys ∪ PATH ${JSON.stringify(expected)} (host-marker closure broken)`,
        file: "packages/cdd-engine/config/engine-config.json",
      });
    }
    return hits;
  }

  #checkHarnessRefs(opts: { skills?: AnatomySkill[] }) {
    const hits: Array<{ label: string; file: string }> = [];
    const refs = this.contract().refs ?? {};
    const skills = opts.skills ?? this.#discoverSkills();
    const refRe = /\/?(?:superpowers|mattpocock-skills|impeccable|kairos):([a-z][a-z-]*)/g;
    for (const { path: p } of skills) {
      const src = readFileSync(p, "utf8");
      for (const line of src.split("\n")) {
        refRe.lastIndex = 0;
        for (let m = refRe.exec(line); m !== null; m = refRe.exec(line)) {
          const key = m[0].startsWith("/") ? m[0].slice(1) : m[0];
          const bare = m[1];
          if (!(key in refs)) {
            hits.push({
              label: `SKILL text reference ${key} is not a registered ref key (refs table drift)`,
              file: path.relative(ROOT, p),
            });
            continue;
          }
          if (!line.includes(`（pi：/skill:${bare}）`)) {
            hits.push({
              label: `SKILL text reference ${key} carries no pi dual form （pi：/skill:${bare}） (zero-bare-ns pin)`,
              file: path.relative(ROOT, p),
            });
          }
        }
      }
    }
    return hits;
  }

  #checkHarnessPrefix() {
    const hits: Array<{ label: string; file: string }> = [];
    const contract = this.contract();
    const dispatch = contract.dispatch ?? {};
    const refs = contract.refs ?? {};
    const rows = Object.entries(contract).filter(
      ([key, row]) => key !== "dispatch" && key !== "refs" && row && typeof row === "object",
    );
    const harnessIds = rows.map(([id]) => id);

    // The dispatch slots resolve to ref keys; a slot whose value is a `pkg:skill`-shaped string
    // must be a REGISTERED ref key (a ref-shaped slot outside the table = drift); a colon-free
    // literal (review spec/plan) is the harness-agnostic URC wording and has no per-harness form.
    // The `{ ref, note }` object form (review task/branch) names its ref key the same way.
    const dispatchRefs: string[] = [];
    const pushSlot = (slot: string, value: unknown): void => {
      if (typeof value === "string") {
        // A ref-shaped dispatch-slot string (`pkg:skill`, lowercase — a registered ref key) must
        // be registered; a non-ref-shaped literal (the URC wording — spaces/uppercase/parens) is
        // harness-agnostic and has no per-harness form.
        if (/^[a-z][a-z-]*:[a-z][a-z-]*$/.test(value)) {
          if (value in refs) dispatchRefs.push(value);
          else
            hits.push({
              label: `dispatch slot ${slot} names an unregistered ref key ${value} (refs table drift)`,
              file: "packages/cdd-engine/config/harness-contract.json",
            });
        }
        return;
      }
      if (value && typeof value === "object") {
        const ref = (value as { ref?: string }).ref;
        if (typeof ref === "string") {
          if (ref in refs) dispatchRefs.push(ref);
          else
            hits.push({
              label: `dispatch slot ${slot} names an unregistered ref key ${ref} (refs table drift)`,
              file: "packages/cdd-engine/config/harness-contract.json",
            });
        }
      }
    };
    for (const [op, v] of Object.entries(dispatch)) {
      if (v && typeof v === "object") {
        for (const [type, slot] of Object.entries(v as Record<string, unknown>)) {
          pushSlot(`${op}:${type}`, slot);
        }
      } else {
        pushSlot(op, v);
      }
    }

    // Every dispatch-slot ref key must render a valid per-harness form (the actual injected
    // prefix), and the full refs table must be consistent: pi is always `/skill:<bare>`,
    // claude/cursor always `/namespace:skill` — a divergence anywhere is prefix-derivation drift.
    const expectForm = (ref: string, id: string): string => {
      const bare = ref.split(":")[1];
      return id === "pi" ? `/skill:${bare}` : `/${ref}`;
    };
    for (const ref of [...new Set([...dispatchRefs, ...Object.keys(refs)])]) {
      const entry = refs[ref] ?? {};
      for (const id of harnessIds) {
        const form = entry[id];
        if (!form) {
          hits.push({
            label: `ref ${ref} has no form for harness ${id} (refs table missing a column)`,
            file: "packages/cdd-engine/config/harness-contract.json",
          });
          continue;
        }
        const expect = expectForm(ref, id);
        if (form !== expect) {
          hits.push({
            label: `ref ${ref} form for ${id} is ${JSON.stringify(form)} ≠ derived ${JSON.stringify(expect)} (prefix derivation drift)`,
            file: "packages/cdd-engine/config/harness-contract.json",
          });
        }
      }
    }
    return hits;
  }

  #checkHarnessInstall(opts: { readmes?: string[] }) {
    const hits: Array<{ label: string; file: string }> = [];
    const contract = this.contract();
    const refs = contract.refs ?? {};
    const rows = Object.entries(contract).filter(
      ([key, row]) => key !== "dispatch" && key !== "refs" && row && typeof row === "object",
    );
    const harnessIds = rows.map(([id]) => id);
    // The install package set: kairos self-install + every refs-table namespace (the upstream
    // plugins the skills open-reference). Missing install rows for a referenced package = drift.
    const installPkgs = new Set(["kairos"]);
    for (const key of Object.keys(refs)) {
      const ns = key.split(":")[0];
      if (ns !== "kairos") installPkgs.add(ns);
    }
    const readmes = opts.readmes ?? [
      "packages/kairos/README.md",
      "packages/kairos/README.zh-CN.md",
    ];

    // Every harness row must declare an install banner for each install package.
    for (const [id, row] of rows) {
      const install = (row as { install?: Record<string, string[]> }).install;
      if (!install) continue;
      for (const pkg of installPkgs) {
        if (install[pkg] === undefined) {
          hits.push({
            label: `harness ${id} install row missing package ${pkg} (install table drift)`,
            file: "packages/cdd-engine/config/harness-contract.json",
          });
        }
      }
    }
    // The README upstream dependency table must equal the install rows verbatim (the user-provided
    // commands render from the install data only — the "single copy" pin); rendered cells carry
    // markdown backticks the data does not (the plain command string is the data value).
    for (const rel of readmes) {
      const md = readFileSync(path.isAbsolute(rel) ? rel : path.join(ROOT, rel), "utf8");
      for (const [id, row] of rows) {
        const install = (row as { install?: Record<string, string[]> }).install;
        if (!install) continue;
        for (const [pkg, cmd] of Object.entries(install)) {
          const rowMatch = md.match(
            new RegExp(`^\\|\\s*${escapeRegExp(pkg)}\\s*\\|([^\\n]*)$`, "m"),
          );
          if (!rowMatch) {
            hits.push({
              label: `README upstream table has no row for package ${pkg} (install render drift)`,
              file: rel,
            });
            continue;
          }
          const cells = rowMatch[0].split("|").map((c) => c.trim().replace(/`/g, ""));
          const rendered = cells[harnessIds.indexOf(id) + 2] ?? "";
          const cmdText = Array.isArray(cmd) ? cmd.join("；") : (cmd as string);
          if (rendered !== cmdText) {
            hits.push({
              label: `README upstream table cell ${pkg}/${id} ${JSON.stringify(rendered)} ≠ install data ${JSON.stringify(cmdText)} (install render drift)`,
              file: rel,
            });
          }
        }
      }
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

// ---------------------------------------------------------------------------
// checkMarkers helpers — the host-marker three-way consistency face (T3)
// ---------------------------------------------------------------------------

/** Bounded-set equality (the identity/closure comparisons in checkMarkers). */
function setEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** The brace-balanced span opened by src[openIndex] (the caller's `{`). */
function braceBody(src: string, openIndex: number): { body: string; end: number } {
  let depth = 0;
  for (let i = openIndex; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return { body: src.slice(openIndex + 1, i), end: i };
    }
  }
  return { body: src.slice(openIndex + 1), end: src.length };
}

/** Parse every Harness subclass block in harness.ts and index it by the `readonly id` it declares
 *  (the id is the marker data's key — the linkage between the two faces is source-derived). */
function harnessClassesById(harnessSrc: string): Map<string, { body: string }> {
  const out = new Map<string, { body: string }>();
  const re = /class\s+([A-Za-z0-9_]+)\s+extends\s+Harness\s*\{/g;
  for (let m = re.exec(harnessSrc); m !== null; m = re.exec(harnessSrc)) {
    const open = m.index + m[0].length - 1;
    const { body } = braceBody(harnessSrc, open);
    const id = body.match(/readonly\s+id\s*=\s*"([^"]+)"/)?.[1];
    if (id) out.set(id, { body });
  }
  return out;
}

/** The detect() predicate of one harness class block: the env-parameter name + the brace-balanced
 *  method body (null when the class carries no matching predicate). The parameter name is captured
 *  so the env-key scan follows a renamed parameter without a false drift firing. */
function detectPredicate(classBody: string): { paramName: string; body: string } | null {
  const sig = classBody.match(/detect\s*\(\s*([A-Za-z_$][\w$]*)\s*:[^;()]*\)\s*:\s*boolean\s*\{/);
  if (!sig) return null;
  // A successful match always exposes its start index (the regex is non-global here).
  if (sig.index === undefined) throw new Error("matched regex missing index");
  const open = sig.index + sig[0].length - 1;
  const { body } = braceBody(classBody, open);
  return { paramName: sig[1], body };
}

/** Env keys a predicate body reads via its parameter object (`param.KEY` / `param["KEY"]`). */
function envKeysUsed(src: string, param: string): string[] {
  const keys: string[] = [];
  const re = new RegExp(
    `\\b${escapeRegExp(param)}\\s*\\.\\s*([A-Za-z0-9_]+)|\\b${escapeRegExp(param)}\\s*\\[\\s*["']([^"']+)["']\\s*\\]`,
    "g",
  );
  for (let m = re.exec(src); m !== null; m = re.exec(src)) keys.push(m[1] ?? m[2]);
  return keys;
}

/** The env-channel row shape of the engine-config context-contract (JSON data — each row carries
 *  either a single `var` key or a `markers` array; other keys are ignored). */
interface EnvChannelRow {
  var?: unknown;
  markers?: unknown;
}

/** The env-channel key set of a context-contract section (the var / markers union). */
function configEnvKeys(ctx: Record<string, unknown>): string[] {
  // JSON-derived engine-config data — the channel value map is narrowed to its row shape.
  const env = (ctx.channels as { env?: Record<string, EnvChannelRow> } | undefined)?.env ?? {};
  return Object.values(env).flatMap((v) =>
    typeof v.var === "string" ? [v.var] : Array.isArray(v.markers) ? (v.markers as string[]) : [],
  );
}

/** Load the engine-config context-contract section (the config face shared with checkConfig). */
function loadConfigCtx(engineConfig?: Record<string, unknown>): Record<string, unknown> {
  return (
    engineConfig ??
    // JSON.parse boundary: the shipped engine-config always carries its contextContract section.
    (
      JSON.parse(
        readFileSync(
          resolveResourceSrc(
            "engine-config",
            path.join(HERE, "..", "..", "packages", "cdd-engine", "src"),
          ),
          "utf8",
        ),
      ) as { contextContract: Record<string, unknown> }
    ).contextContract
  );
}
