// scripts/lib/guard.ts — the guard library. The guards CONSUME
// the engine's typed exports — the new tree's metadata is the single data source,
// never a parallel regex allowlist re-walked in this tree:
//
//   · checkAnatomy  — the skill structure contract: the node-anchored SKILL.md
//     assertions (section-heading registry · digraph-consistency · the four-element
//     contract · the closed-set roster · the unified-skeleton family shape · the
//     zero-state-label rule · the next: route-fact consumption · growth boundary ·
//     consumer purity), driven by the typed skill-anatomy contract
//     (src-next/contract/skill-anatomy.ts) — every heading, pattern and limit is
//     that contract's data, never a literal restate in this body.
//   · checkWords    — The word-face audit: the guard-ban vocabulary (stale / gate /
//     shape families) is the word table's export (src-next/face/words.ts, the ban
//     table's data-source face); the scan releases those rows as data, so the live
//     faces must carry zero of them (the retired-vocabulary zero-hit).
//   · checkChannels — the channel audit: the CLI flag channel closure (command keys
//     × the runtime argv channel), the host-marker closure (from the harness detect
//     rows, single source) and the dispatch/refs derivation (every dispatch ref
//     registered + every per-harness slash form derived) — all asserted against the
//     typed runtime/host exports, zero parallel allowlist.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions
// except the admitted pure discovery/parse helpers below.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SKILL_ANATOMY,
  type SkillAnatomyContract,
  type SkillRosterRow,
} from "../../packages/cdd-engine/src-next/contract/skill-anatomy.ts";
import { CLI_COMMANDS } from "../../packages/cdd-engine/src-next/face/cli.ts";
import {
  DISPATCH,
  type DispatchTable,
  HOSTS,
  type HostId,
  type HostReferenceTable,
  type HostRow,
  REFS,
} from "../../packages/cdd-engine/src-next/face/host.ts";
import { GUARD_BAN_WORDS } from "../../packages/cdd-engine/src-next/face/words.ts";
import {
  ARGV_CHANNEL,
  type ChannelArgRow,
} from "../../packages/cdd-engine/src-next/infra/runtime.ts";
import { scanToken } from "./scan.ts";

/** The guard finding — one violation of a check face (label + file attribution). */
export interface GuardFinding {
  label: string;
  file: string;
}

/** One skill the anatomy check parses. */
export interface AnatomySkill {
  /** The skill name (the dir name under the skills root). */
  name: string;
  /** The SKILL.md absolute path. */
  path: string;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The default skills root — packages/kairos/skills (every cdd skill's SKILL.md). */
const SKILLS_ROOT = path.join(ROOT, "packages", "kairos", "skills");

/** The word-face audit's source faces (the retired-vocabulary zero-hit scroll) — the
 *  new-tree planes only: the surfaces this tree owns must carry zero of its own
 *  retired vocabulary (the kairos behavior tests pin the residue surfaces themselves
 *  as data — their assertion subjects name the tokens deliberately; the skills face
 *  scans the full ban vocabulary separately). */
const SOURCE_FACES = ["packages/cdd-engine/src-next", "scripts"] as const;

/** The ban vocabulary's own data homes — the files whose quoted rows ARE the release
 *  form (the word table's ban rows + the harness contract's cli data value). A live
 *  face must never carry the lexeme outside these homes. */
const RELEASE_FILES = [
  "packages/cdd-engine/src-next/face/words.ts",
  "packages/cdd-engine/src-next/face/host.ts",
] as const;

// ---------------------------------------------------------------------------
// The kairos skills-count single truth (the re-homed old kairos.ts export)
// ---------------------------------------------------------------------------

/** "A skill = a directory containing SKILL.md" — the shared count definition the
 *  pi-package (pi-package.test.ts / pi-install-smoke.test.ts) behavior tests consume;
 *  a definition change needs this one edit only. */
export function countSkillsWithMarkdown(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md")),
  ).length;
}

/** The authoritative kairos skills count — the closed six-set's cardinality from the
 *  typed skill-anatomy roster (never a local literal); shared by the directory-scan
 *  guard + the pi-package behavior tests (a definition change is a roster edit). */
export const EXPECTED = Object.keys(SKILL_ANATOMY.skills.registry).length;

// ---------------------------------------------------------------------------
// The anatomy analysis helpers — SKILL.md parsing (structure extraction)
// ---------------------------------------------------------------------------

interface AnalyzedSkill {
  name: string;
  src: string;
  headings: { h2: string[]; h3: string[] };
  digraph: { mermaid: string | null; trailing: string };
  nodes: Array<{ id: string; type: "rect" | "diamond" | "terminal"; label: string }>;
  edges: Array<{ from: string; label: string; to: string }>;
  sections: string[];
  blocks: Array<{ name: string; block: string }>;
}

/** Strip every ``` fence block to blank lines (so fenced content cannot masquerade
 *  as headings in the structural scan). */
function stripFences(src: string): string {
  return src.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*\n?/gm, (m) => m.replace(/[^\n]/g, ""));
}

/** The digraph parse — operator []/decision {}/terminal (()) nodes + `-->` edges. */
function parseDigraph(src: string): Pick<AnalyzedSkill, "nodes" | "edges"> {
  const m = src.match(/```mermaid\n([\s\S]*?)```/);
  if (m === null) return { nodes: [], edges: [] };
  const block = m[1]!;
  const nodes: AnalyzedSkill["nodes"] = [];
  const seen = new Set<string>();
  const nodeRe = /(\w+)\[([^\]]+)\]|(\w+)\{([^}]+)\}|(\w+)\(\(([^)]+)\)\)/g;
  for (let mm = nodeRe.exec(block); mm !== null; mm = nodeRe.exec(block)) {
    const id = mm[1] ?? mm[3] ?? mm[5];
    const label = (mm[2] ?? mm[4] ?? mm[6] ?? "").trim();
    const type = mm[2] !== undefined ? "rect" : mm[4] !== undefined ? "diamond" : "terminal";
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({ id, type, label });
  }
  const edges: AnalyzedSkill["edges"] = [];
  const edgeRe = /(\w+)(?:\[[^\]]*\]|\{[^}]*\}|\(\([^)]*\)\))?\s*-->\s*(?:\|([^|]*)\|)?\s*(\w+)/g;
  for (let em = edgeRe.exec(block); em !== null; em = edgeRe.exec(block)) {
    edges.push({ from: em[1]!, label: (em[2] ?? "").trim(), to: em[3]! });
  }
  return { nodes, edges };
}

/** The `### `node`` section headers — the node-definitions' parsing record. */
function extractSections(src: string): string[] {
  const sections: string[] = [];
  const re = /^### `([^`]+)`/gm;
  for (const m of src.matchAll(re)) sections.push(m[1]!);
  return sections;
}

/** The digraph section's mermaid block + the trailing prose after its close fence. */
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

/** The per-node definition blocks — the prose following each `### `node`` header. */
function nodeBlocks(src: string): AnalyzedSkill["blocks"] {
  const blocks: AnalyzedSkill["blocks"] = [];
  for (const m of src.matchAll(/^### `([^`]+)`/gm)) {
    const rest = src.slice(m.index + m[0].length);
    const relEnd = rest.search(/\n(?=#{1,3} )/);
    blocks.push({ name: m[1]!, block: relEnd === -1 ? rest : rest.slice(0, relEnd) });
  }
  return blocks;
}

/** The full SKILL.md analysis — the parse record the anatomy assertions read. */
function analyzeSkill(name: string, src: string): AnalyzedSkill {
  const stripped = stripFences(src);
  const sectionRegistry = SKILL_ANATOMY.sectionRegistry;
  const flowDigraphHeading = sectionRegistry.sections.flowDigraph.heading ?? "## Flow Digraph";
  return {
    name,
    src,
    headings: {
      h2: [...stripped.matchAll(/^## [^\n]*$/gm)].map((mm) => mm[0].trim()),
      h3: [...stripped.matchAll(/^### [^\n]*$/gm)].map((mm) => mm[0].trim()),
    },
    digraph: digraphSection(src, flowDigraphHeading),
    ...parseDigraph(src),
    sections: extractSections(src),
    blocks: nodeBlocks(src),
  };
}

/**
 * The guard library — the new-tree validation checks. Instance methods only; every
 * structure fact / token / limit reads its single source (the typed planes), never
 * a hand-written second allowlist in this body. The constructor's override options
 * let tests inject broken dispatch/refs tables to exercise a check's fail face.
 */
export class GuardLibrary {
  readonly #dispatch: DispatchTable;
  readonly #refs: HostReferenceTable;
  readonly #hosts: Readonly<Record<HostId, HostRow>>;
  readonly #channels: Readonly<Record<string, ChannelArgRow>>;

  constructor(
    overrides: {
      dispatch?: DispatchTable;
      refs?: HostReferenceTable;
      hosts?: Readonly<Record<HostId, HostRow>>;
      channels?: Readonly<Record<string, ChannelArgRow>>;
    } = {},
  ) {
    this.#dispatch = overrides.dispatch ?? DISPATCH;
    this.#refs = overrides.refs ?? REFS;
    this.#hosts = overrides.hosts ?? HOSTS;
    this.#channels = overrides.channels ?? ARGV_CHANNEL;
  }
  /** Discover the kairos skills (the dirs carrying SKILL.md under the skills root). */
  #discoverSkills(root = SKILLS_ROOT): AnatomySkill[] {
    const out: AnatomySkill[] = [];
    for (const ent of readdirSync(root, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const p = path.join(root, ent.name, "SKILL.md");
      if (existsSync(p)) out.push({ name: ent.name, path: p });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // checkAnatomy(skills?) — the skill structure contract (node-anchored SKILL.md)
  // -------------------------------------------------------------------------

  /**
   * checkAnatomy(skills?) — the schema-driven SKILL.md anatomy assertions. Every
   * structure literal (headings · heading grammar · element patterns · growth
   * limits · forbidden heads · the crossings registry) reads from the typed
   * skill-anatomy contract (src-next/contract/skill-anatomy.ts); skillsOverride
   * lets tests inject temp skills. Returns the aggregated findings (empty = pass).
   */
  checkAnatomy(skillsOverride?: AnatomySkill[]): GuardFinding[] {
    const anatomy = SKILL_ANATOMY;
    const reg = anatomy.sectionRegistry;
    const findings: GuardFinding[] = [];

    const PUBLIC_SECTION_KEYS = reg.public;
    const SECTION_HEADINGS = Object.fromEntries(
      Object.entries(reg.sections).map(([key, node]) => [key, node.heading]),
    ) as Record<string, string>;
    const NODE_HEADING_RE = new RegExp(reg.headingKinds.nodeName.pattern, "m");
    const GROWTH_NODE_LIMIT = anatomy.growthBoundary.nodeLimit;
    const GROWTH_EDGE_LIMIT = anatomy.growthBoundary.edgeLimit;
    const REGISTERED_CROSSINGS = Object.keys(anatomy.growthBoundary.registry.crossings);
    const FORBIDDEN_HEADS = anatomy.consumerPurity.forbiddenNarrativeHeads.map(
      (h) => new RegExp(`^${escapeRegExp(h)}$`, "m"),
    );
    const ELEMENT_PATTERNS = Object.fromEntries(
      Object.entries(anatomy.nodeElements).map(([field, node]) => [
        field,
        new RegExp(node.pattern, "m"),
      ]),
    ) as Record<string, RegExp>;

    const skills = skillsOverride ?? this.#discoverSkills();
    const analyzed = skills.map((skill) => ({
      skill,
      an: analyzeSkill(skill.name, readFileSync(skill.path, "utf8")),
    }));

    for (const { skill, an } of analyzed) {
      // The strict section-heading allowlist (h2 + the h3 grammar).
      const known = new Set(Object.values(SECTION_HEADINGS));
      for (const h of an.headings.h2.filter((h) => !known.has(h))) {
        findings.push({
          label: `${skill.name}: unregistered \`## \` heading(s): "${h}" — ${anatomy.wording.registryRule}`,
          file: skill.path,
        });
      }
      for (const key of PUBLIC_SECTION_KEYS) {
        if (!an.headings.h2.includes(SECTION_HEADINGS[key]!)) {
          findings.push({
            label: `${skill.name}: missing public section \`${SECTION_HEADINGS[key]}\` — ${anatomy.wording.registryRule}`,
            file: skill.path,
          });
        }
      }
      for (const h of an.headings.h3.filter((h) => !NODE_HEADING_RE.test(h))) {
        findings.push({
          label: `${skill.name}: unregistered \`### \` heading(s): "${h}" — ${anatomy.wording.headingKindRule}`,
          file: skill.path,
        });
      }

      // The digraph section content — mermaid-only + zero trailing prose.
      if (an.digraph.mermaid === null) {
        findings.push({
          label: `${skill.name}: the Flow Digraph section carries no mermaid block — ${anatomy.wording.digraphContentRule}`,
          file: skill.path,
        });
      } else if (an.digraph.trailing.trim() !== "") {
        findings.push({
          label: `${skill.name}: prose after the mermaid block ("${an.digraph.trailing.trim().split("\n")[0]}") — ${anatomy.wording.digraphContentRule}`,
          file: skill.path,
        });
      }

      // Assertion 1 — the bidirectional operator-node ↔ definition completeness.
      const nodeLabels = new Set(an.nodes.filter((n) => n.type === "rect").map((n) => n.label));
      const diamonds = new Set(an.nodes.filter((n) => n.type === "diamond").map((n) => n.label));
      for (const n of an.nodes.filter((n) => n.type === "rect" && !an.sections.includes(n.label))) {
        findings.push({
          label: `${skill.name}: dangling node without a \`### \`node\`\` definition: "${n.label}" (id=${n.id}) — ${anatomy.wording.nodeDefinitionRule}`,
          file: skill.path,
        });
      }
      for (const s of an.sections.filter((s) => !nodeLabels.has(s) && !diamonds.has(s))) {
        findings.push({
          label: `${skill.name}: orphan \`### \` section with no digraph node: \`${s}\` — ${anatomy.wording.nodeDefinitionRule}`,
          file: skill.path,
        });
      }

      // The per-node four-element contract.
      for (const { name, block } of an.blocks) {
        for (const [field, re] of Object.entries(ELEMENT_PATTERNS)) {
          if (!re.test(block)) {
            findings.push({
              label: `${skill.name}: node \`${name}\` missing its **${field}:** element — ${anatomy.wording.nodeElementRule}`,
              file: skill.path,
            });
          }
        }
      }

      // The skeleton-discipline heuristic — no standalone Rules / Red Flags headings.
      if (/^#{1,2} Rules$/m.test(an.src)) {
        findings.push({
          label: `${skill.name}: found standalone "## Rules" heading`,
          file: skill.path,
        });
      }
      if (/^#{1,2} Red Flags$/m.test(an.src)) {
        findings.push({
          label: `${skill.name}: found standalone "## Red Flags" heading`,
          file: skill.path,
        });
      }

      // The unified-skeleton family shape — the loop hub / the no-self-loop
      // exceptions (Assertion 2, §4.2: shared node names never drift across the
      // five chains).
      const row = anatomy.skills.registry[skill.name];
      if (row !== undefined) {
        findings.push(
          ...this.#familyShapeFindings(skill.name, skill.path, an, row.family, anatomy),
        );
      }

      // The edge-condition contract (v1.20 — the label-free rule reversed) + the
      // next: route-fact consumption scan.
      findings.push(...this.#edgeConditionFindings(skill.name, skill.path, an, anatomy, row));
      for (const line of an.src.split("\n")) {
        const station = line.indexOf("next:");
        if (station === -1) continue;
        if (/cdd (implement|review|fix|base|schema|issue)(\s|[`"])/.test(line.slice(station))) {
          findings.push({
            label: `${skill.name}: a full command string follows the next: token on the line — ${anatomy.wording.routeFactRule}`,
            file: skill.path,
          });
        }
      }
    }

    // The closed-set guard — the directory scan must equal the roster exactly (the
    // live discovery only; the per-skill injection face cannot testify about the tree).
    if (skillsOverride === undefined) {
      const registered = Object.keys(anatomy.skills.registry).sort();
      const discovered = analyzed.map(({ skill }) => skill.name).sort();
      for (const name of registered.filter((name) => !discovered.includes(name))) {
        findings.push({
          label: `missing registered skill: ${name} — ${anatomy.wording.closedSetRule}`,
          file: path.join(SKILLS_ROOT, name, "SKILL.md"),
        });
      }
      for (const name of discovered.filter((name) => !registered.includes(name))) {
        findings.push({
          label: `unregistered skill directory: ${name} — ${anatomy.wording.closedSetRule}`,
          file: path.join(SKILLS_ROOT, name, "SKILL.md"),
        });
      }
    }

    // Assertion 3 — the growth signal + the consumer-purity zero-trace rule.
    for (const { skill, an } of analyzed) {
      const edgeKeys = new Set(an.edges.map((e) => `${e.from}|${e.label}|${e.to}`));
      const nodeCount = an.nodes.length;
      const edgeCount = edgeKeys.size;
      if (
        (nodeCount > GROWTH_NODE_LIMIT || edgeCount > GROWTH_EDGE_LIMIT) &&
        !REGISTERED_CROSSINGS.includes(skill.name)
      ) {
        findings.push({
          label:
            `${skill.name}: digraph (${nodeCount} nodes · ${edgeCount} edges) crosses the growth boundary ` +
            `(${GROWTH_NODE_LIMIT} nodes / ${GROWTH_EDGE_LIMIT} edges) — its rationale must be registered in the ` +
            `skill-anatomy growth registry — ${anatomy.wording.growthRule}`,
          file: skill.path,
        });
      }
      for (const re of FORBIDDEN_HEADS) {
        if (re.test(an.src)) {
          findings.push({
            label:
              `${skill.name}: consumer-surface purity — the SKILL.md may not carry a growth/refactor narrative heading ` +
              `(found "${re.source}") — ${anatomy.wording.purityRule}`,
            file: skill.path,
          });
        }
      }
    }

    return findings;
  }

  /** The unified-skeleton family-shape findings (§4.2) — the loop family carries the
   *  shared NEXT-LOOP hub + its single self-loop + the commit-* and handoff-*
   *  terminals; the close/onepass families are the explicit no-self-loop exceptions
   *  (cdd-close ends at the finish semantic gate + terminal · cdd-report one-shot
   *  toolchain). A registered skill that violates its family shape fails — the
   *  shared node names are registry data, never a re-typed literal. */
  #familyShapeFindings(
    name: string,
    skillPath: string,
    an: AnalyzedSkill,
    family: "loop" | "close" | "onepass",
    anatomy: SkillAnatomyContract,
  ): GuardFinding[] {
    const findings: GuardFinding[] = [];
    const hub = anatomy.digraph.loopHubNode.name;
    const hubNode = an.nodes.find((n) => n.label === hub);
    const hubSelfLoop =
      hubNode !== undefined && an.edges.some((e) => e.from === hubNode.id && e.to === hubNode.id);
    if (family === "loop") {
      if (hubNode === undefined) {
        findings.push({
          label: `${name}: missing the shared ${hub} hub — ${anatomy.wording.loopShapeRule}`,
          file: skillPath,
        });
      } else if (!hubSelfLoop) {
        findings.push({
          label: `${name}: the ${hub} hub carries no single self-loop — ${anatomy.wording.loopShapeRule}`,
          file: skillPath,
        });
      }
      for (const prefix of anatomy.digraph.loopHubNode.rowPrefixes) {
        if (!an.nodes.some((n) => n.type === "rect" && n.label.startsWith(prefix))) {
          findings.push({
            label: `${name}: missing the ${prefix}* terminal — ${anatomy.wording.loopShapeRule}`,
            file: skillPath,
          });
        }
      }
    } else {
      if (hubSelfLoop) {
        findings.push({
          label: `${name}: the no-self-loop family carries a ${hub} self-loop — ${anatomy.wording.enderShapeRule}`,
          file: skillPath,
        });
      }
      if (
        family === "close" &&
        !an.nodes.some((n) => n.type === "diamond" && n.label.startsWith("finish"))
      ) {
        findings.push({
          label: `${name}: the close family is missing its finish semantic gate — ${anatomy.wording.enderShapeRule}`,
          file: skillPath,
        });
      }
    }
    return findings;
  }

  /** The edge-condition contract findings (v1.20 — the label-free rule reversed): every
   *  edge out of a decision node carries an explicit condition label; the loop family's
   *  NEXT-LOOP hub carries EXACTLY the three pinned out-edges (the `until next=done`
   *  self-loop · the `next=done` closure exit · the `no next` BLOCKED face), each label
   *  an engine-lexicon pinned phrase (edgeConditionWords — the word-table pin, one word table
   *  shared with the runtime `next:` instance); the executor chain's branch-review loop
   *  is an INDEPENDENT closed loop (branch-review↔branch-fix), never a route through
   *  the implementation hub. */
  #edgeConditionFindings(
    name: string,
    skillPath: string,
    an: AnalyzedSkill,
    anatomy: SkillAnatomyContract,
    row: SkillRosterRow | undefined,
  ): GuardFinding[] {
    const findings: GuardFinding[] = [];
    const labelId = new Map<string, string>();
    const idLabel = new Map<string, string>();
    for (const node of an.nodes) {
      labelId.set(node.label, node.id);
      idLabel.set(node.id, node.label);
    }
    const diamondIds = new Set(an.nodes.filter((n) => n.type === "diamond").map((n) => n.id));

    // The decision-edge condition mandate — every edge out of a decision node carries an explicit condition.
    for (const edge of an.edges) {
      if (diamondIds.has(edge.from) && edge.label === "") {
        findings.push({
          label: `${name}: unlabeled decision edge ${edge.from} → ${edge.to} — ${anatomy.wording.edgeConditionRule}`,
          file: skillPath,
        });
      }
    }

    if (row === undefined || row.family !== "loop") return findings;

    const hub = anatomy.digraph.loopHubNode.name;
    const hubId = labelId.get(hub);
    if (hubId === undefined) return findings; // the missing-hub finding is the family shape's row
    const conditions = anatomy.digraph.nextLoopConditions;
    const branchLoop = row.role === "executor";
    const out = an.edges.filter((e) => e.from === hubId);

    // The three-out-edge assertion + word-table pin — the loop hub's exactly-three pinned out-edges.
    const selfLoop = an.edges.find((e) => e.from === hubId && e.to === hubId);
    const doneExit = out.find((e) => e.label === "next=done");
    const noNext = out.find((e) => e.label === "no next");
    if (selfLoop === undefined || selfLoop.label !== "until next=done") {
      findings.push({
        label: `${name}: the ${hub} self-loop must carry the pinned condition label "until next=done" — ${anatomy.wording.edgeConditionRule}`,
        file: skillPath,
      });
    }
    if (doneExit === undefined || (idLabel.get(doneExit.to) ?? "").startsWith("BLOCKED")) {
      findings.push({
        label: `${name}: the ${hub} closure exit must be the "next=done" edge into a terminal node — ${anatomy.wording.edgeConditionRule}`,
        file: skillPath,
      });
    }
    if (noNext === undefined || !(idLabel.get(noNext.to) ?? "").startsWith("BLOCKED")) {
      findings.push({
        label: `${name}: the ${hub} failure face must be the "no next" edge into the BLOCKED terminal — ${anatomy.wording.edgeConditionRule}`,
        file: skillPath,
      });
    }
    if (out.length !== 3) {
      findings.push({
        label: `${name}: the ${hub} hub carries ${out.length} out-edge(s), expected exactly the three pinned (until next=done · next=done · no next) — ${anatomy.wording.edgeConditionRule}`,
        file: skillPath,
      });
    }
    for (const edge of out) {
      if (!conditions.includes(edge.label)) {
        findings.push({
          label: `${name}: the ${hub} out-edge label "${edge.label}" is outside the engine-lexicon pinned phrases — ${anatomy.wording.loopConditionPinRule}`,
          file: skillPath,
        });
      }
    }

    // The branch loop-shape assertion — the executor's independent branch-review closed loop.
    if (branchLoop) {
      const reviewId = labelId.get("branch-review");
      const fixId = labelId.get("branch-fix");
      if (
        reviewId === undefined ||
        fixId === undefined ||
        !an.edges.some((e) => e.from === reviewId && e.to === fixId) ||
        !an.edges.some((e) => e.from === fixId && e.to === reviewId)
      ) {
        findings.push({
          label: `${name}: the executor chain is missing the independent branch-review↔branch-fix closed loop — ${anatomy.wording.branchLoopRule}`,
          file: skillPath,
        });
      }
      if (fixId !== undefined && an.edges.some((e) => e.from === fixId && e.to === hubId)) {
        findings.push({
          label: `${name}: the branch-fix node routes into the ${hub} hub — the branch loop must close on itself (until next=done), never through the implementation loop — ${anatomy.wording.branchLoopRule}`,
          file: skillPath,
        });
      }
    }

    return findings;
  }

  // -------------------------------------------------------------------------
  // checkWords(faces?) — the word-face audit (the guard-ban vocabulary, data-derived)
  // -------------------------------------------------------------------------

  /**
   * checkWords(skillsOverride?) — the word-face audit: the guard-ban vocabulary from
   * the word table's ban family (the STALE/GATE/SHAPE rows — the ban table's
   * data-source face) scanned against the kairos SKILL.md surface (all three
   * families) and the source faces (the stale + gate retired-vocabulary zero-hit).
   * The token set is the exported data — zero hand-written second list in this body.
   * A quoted data row inside the ban vocabulary's own data home (the word-table
   * rows · the harness cli data values) is the release form and stays silent.
   */
  checkWords(skillsOverride?: AnatomySkill[]): GuardFinding[] {
    const banFamilies = GUARD_BAN_WORDS;
    const staleTokens = banFamilies.stale.map((row) => row.token);
    const gateTokens = banFamilies.gate.map((row) => row.token);
    const shapeTokens = banFamilies.shape.map((row) => row.token);

    const findings: GuardFinding[] = [];

    // The skill texts — every ban family must be absent from the consumer surface.
    const skills = skillsOverride ?? this.#discoverSkills();
    const skillTargets = skills.map((s) => path.relative(ROOT, s.path));
    findings.push(
      ...this.#scanBans(
        skillTargets,
        [...staleTokens, ...gateTokens, ...shapeTokens],
        "skill text",
      ),
    );

    // The source faces — the retired stale + gate vocabulary stays at zero.
    findings.push(
      ...this.#scanBans([...SOURCE_FACES], [...staleTokens, ...gateTokens], "source face"),
    );

    return findings;
  }

  /** One banned-token scan lane over the targets (repo-relative), release-masked.
   *  The guard's own test position (scripts/__tests__) is excluded — the same
   *  self-exempt ruling the old scripts applied to its own regression tests. */
  #scanBans(targets: readonly string[], tokens: readonly string[], kind: string): GuardFinding[] {
    const findings: GuardFinding[] = [];
    for (const token of tokens) {
      for (const hit of scanToken(targets, token, ROOT, {
        releaseFiles: RELEASE_FILES,
        excludePaths: ["scripts/__tests__"],
      })) {
        findings.push({
          label: `${kind} carries the guard-ban token "${token}" (line ${hit.line})`,
          file: hit.file,
        });
      }
    }
    return findings;
  }

  // -------------------------------------------------------------------------
  // checkChannels() — the channel audit (typed export assertions)
  // -------------------------------------------------------------------------

  /**
   * checkChannels() — the channel audit: the CLI channel closure (every command-
   * declared key resolves in the runtime argv channel, and every non-program argv
   * channel key is declared by a command), the host-marker closure (detect env keys
   * ∪ PATH — derived from the harness detect rows as the live single source,
   * compared against a pinned half-update oracle, documented in-check), and the
   * dispatch/refs derivation (every dispatch-slot ref registered + every per-harness
   * slash form derived: pi `/skill:<bare>`, claude/cursor `/<ref>`). All asserted
   * against the typed exports — zero parallel allowlist beyond the host-marker pin.
   */
  checkChannels(): GuardFinding[] {
    const findings: GuardFinding[] = [];

    // 1. The CLI channel closure — command keys × the runtime argv channel.
    const declaredKeys = new Set<string>();
    const channelKeys = Object.keys(this.#channels);
    const channel = this.#channels;
    const collect = (spec: { keys: readonly { key: string }[] }): void => {
      for (const declared of spec.keys) declaredKeys.add(declared.key);
    };
    for (const command of CLI_COMMANDS) {
      collect(command);
      for (const leaf of command.leaves ?? []) collect(leaf);
    }
    for (const key of declaredKeys) {
      if (!channelKeys.includes(key)) {
        findings.push({
          label: `CLI command declares channel key "${key}" absent from the runtime argv channel (channel closure broken)`,
          file: "packages/cdd-engine/src-next/face/cli.ts",
        });
      }
    }
    for (const key of channelKeys) {
      if (declaredKeys.has(key)) continue;
      if (channel[key]?.scope === "program") continue; // the program-level bools (dry-run/help)
      findings.push({
        label: `runtime argv channel key "${key}" is declared by no command and not program-scoped (channel closure broken)`,
        file: "packages/cdd-engine/src-next/infra/runtime.ts",
      });
    }

    // 2. The host-marker closure — detect env keys ∪ PATH. The derived array is the
    //    live single source (every HOSTS detect row's env key); `pinned` is the
    //    deliberate half-update oracle — the frozen expected enumeration the closure
    //    must equal, hand-updated only when the detect surface intentionally grows
    //    (a new harness / renamed env key). The comparison is what catches accidental
    //    drift — the pin is the check's expectation half, not a parallel list.
    const markerKeys = Object.values(this.#hosts).map((row) => row.detect.env);
    const expectedClosure = [...markerKeys, "PATH"].sort();
    const pinned = ["AI_AGENT", "CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "PATH"].sort();
    if (JSON.stringify(expectedClosure) !== JSON.stringify(pinned)) {
      findings.push({
        label: `host-marker closure ${JSON.stringify(expectedClosure)} ≠ the pinned four ${JSON.stringify(pinned)} (drift in the harness detect rows)`,
        file: "packages/cdd-engine/src-next/face/host.ts",
      });
    }

    // 3. The dispatch/refs derivation — every dispatch-slot ref registered + the
    //    per-harness forms derived (pi /skill:<bare> · claude/cursor /<ref>). The
    //    ref-shaped slots (`pkg:skill`, lowercase) are the table entries; a non-ref
    //    literal (the URC prose — spaces/uppercase) has no per-harness form.
    const refKeys: string[] = [];
    const pushRef = (value: string | { ref: string }): void => {
      const ref = typeof value === "string" ? value : value.ref;
      if (/^[a-z][a-z-]*:[a-z][a-z-]*$/.test(ref)) refKeys.push(ref);
    };
    pushRef(this.#dispatch.implement);
    for (const slot of Object.values(this.#dispatch.review)) pushRef(slot);
    for (const ref of refKeys) {
      const form = this.#refs[ref];
      if (form === undefined) {
        findings.push({
          label: `dispatch slot names an unregistered ref key "${ref}" (refs table drift)`,
          file: "packages/cdd-engine/src-next/face/host.ts",
        });
        continue;
      }
      for (const id of ["claude", "cursor", "pi"] as const) {
        const expected = id === "pi" ? `/skill:${ref.split(":")[1]}` : `/${ref}`;
        if (form[id] !== expected) {
          findings.push({
            label: `ref "${ref}" form for ${id} is ${JSON.stringify(form[id])} ≠ derived ${JSON.stringify(expected)} (prefix-derivation drift)`,
            file: "packages/cdd-engine/src-next/face/host.ts",
          });
        }
      }
    }

    return findings;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** RegExp-escape a literal (the schema-contract patterns are quoted verbatim). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The guard library singleton — the validate orchestrator's guard face. */
export const guardLibrary = new GuardLibrary();

/** Expose the guard namespace (ban vocabulary) for the tests' consumption asserts. */
export const GUARD_NAMESPACE = {
  stale: GUARD_BAN_WORDS.stale.map((row) => row.token),
  gate: GUARD_BAN_WORDS.gate.map((row) => row.token),
  shape: GUARD_BAN_WORDS.shape.map((row) => row.token),
} as const;
