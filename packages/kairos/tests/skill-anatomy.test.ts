// packages/kairos/tests/skill-anatomy.test.ts
// P5 — the kairos-side skill-anatomy check, colocated after the D17 six-premise
// ownership-migration (the root guard's checkAnatomy assertion face re-homed into the kairos
// test plane — kairos owns its shipped six SKILL.md products). The judging
// implementation consumes the engine's exported skill-anatomy contract
// (`src-next/contract/skill-anatomy.ts` — the section registry, the node
// elements, the growth boundary, the consumer-purity rule and the roster: every
// heading/pattern/limit is that contract's data, never a literal restate in this
// body); the walker (analyzeSkill — the digraph/section extraction) is the ported
// test-helper layer the guard §2.2 named.
//
// Zero module-level bare functions — the walker + checker are `const` arrows and
// class methods (the P5 zero-`function`-declaration discipline applies to this
// migrated surface too).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { parse as parseYaml } from "yaml";

import {
  SKILL_ANATOMY,
  type SkillAnatomyContract,
  type SkillRosterRow,
} from "../../cdd-engine/src-next/contract/skill-anatomy.ts";
import { EXPECTED } from "./helpers.ts";

/** The kairos skills root — every cdd skill's SKILL.md (the check's scan set). */
const SKILLS_ROOT = path.join(fileURLToPath(new URL("..", import.meta.url)), "skills");
/** A skill directory — the dirs carrying SKILL.md under the skills root. */
const SKILL_DIRS = readdirSync(SKILLS_ROOT, { withFileTypes: true })
  .filter((ent) => ent.isDirectory())
  .map((ent) => ent.name);

/** An analyzed SKILL.md — the parse record the anatomy assertions read. */
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

/** One finding of the anatomy check — the label + the skill attribution. */
interface AnatomyFinding {
  label: string;
  skill: string;
}

/** RegExp-escape a literal (the schema-contract patterns are quoted verbatim). */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Strip every ``` fence block to blank lines (so fenced content cannot
 *  masquerade as headings in the structural scan). */
const stripFences = (src: string): string =>
  src.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*\n?/gm, (m) => m.replace(/[^\n]/g, ""));

/** The digraph parse — operator []/decision {}/terminal (()) nodes + `-->` edges. */
const parseDigraph = (src: string): Pick<AnalyzedSkill, "nodes" | "edges"> => {
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
};

/** The `### `node`` section headers — the node-definitions' parsing record. */
const extractSections = (src: string): string[] => {
  const sections: string[] = [];
  const re = /^### `([^`]+)`/gm;
  for (const m of src.matchAll(re)) sections.push(m[1]!);
  return sections;
};

/** The digraph section's mermaid block + the trailing prose after its close fence. */
const digraphSection = (
  src: string,
  flowDigraphHeading: string,
): { mermaid: string | null; trailing: string } => {
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
};

/** The per-node definition blocks — the prose following each `### `node`` header. */
const nodeBlocks = (src: string): AnalyzedSkill["blocks"] => {
  const blocks: AnalyzedSkill["blocks"] = [];
  for (const m of src.matchAll(/^### `([^`]+)`/gm)) {
    const rest = src.slice(m.index + m[0].length);
    const relEnd = rest.search(/\n(?=#{1,3} )/);
    blocks.push({ name: m[1]!, block: relEnd === -1 ? rest : rest.slice(0, relEnd) });
  }
  return blocks;
};

/** The full SKILL.md analysis — the parse record the anatomy assertions read. */
const analyzeSkill = (name: string, src: string): AnalyzedSkill => {
  const stripped = stripFences(src);
  const flowDigraphHeading = SKILL_ANATOMY.sectionRegistry.sections.flowDigraph.heading;
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
};

/**
 * SkillAnatomyCheck — the kairos-side anatomy judging (the ported checkAnatomy
 * assertion face, driven entirely by the typed skill-anatomy contract). The
 * constructor discovers the live skills; check() returns the aggregated findings
 * (empty = pass).
 */
class SkillAnatomyCheck {
  readonly #findings: AnatomyFinding[] = [];

  /** Run the whole anatomy judgment over the live skills — the aggregated findings. */
  check(): AnatomyFinding[] {
    const anatomy = SKILL_ANATOMY;
    const reg = anatomy.sectionRegistry;
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

    for (const name of SKILL_DIRS) {
      const skillPath = path.join(SKILLS_ROOT, name, "SKILL.md");
      const an = analyzeSkill(name, readFileSync(skillPath, "utf8"));

      // The strict section-heading allowlist (h2 + the h3 grammar).
      const known = new Set(Object.values(SECTION_HEADINGS));
      for (const h of an.headings.h2.filter((h) => !known.has(h))) {
        this.#findings.push({ label: `unregistered \`## \` heading(s): "${h}"`, skill: name });
      }
      for (const key of reg.public) {
        if (!an.headings.h2.includes(SECTION_HEADINGS[key]!)) {
          this.#findings.push({
            label: `missing public section \`${SECTION_HEADINGS[key]}\``,
            skill: name,
          });
        }
      }
      for (const h of an.headings.h3.filter((h) => !NODE_HEADING_RE.test(h))) {
        this.#findings.push({ label: `unregistered \`### \` heading(s): "${h}"`, skill: name });
      }

      // The digraph section content — mermaid-only + zero trailing prose.
      if (an.digraph.mermaid === null) {
        this.#findings.push({
          label: "the Flow Digraph section carries no mermaid block",
          skill: name,
        });
      } else if (an.digraph.trailing.trim() !== "") {
        this.#findings.push({
          label: `prose after the mermaid block ("${an.digraph.trailing.trim().split("\n")[0]}")`,
          skill: name,
        });
      }

      // Assertion 1 — the bidirectional operator-node ↔ definition completeness.
      const nodeLabels = new Set(an.nodes.filter((n) => n.type === "rect").map((n) => n.label));
      const diamonds = new Set(an.nodes.filter((n) => n.type === "diamond").map((n) => n.label));
      for (const n of an.nodes.filter((n) => n.type === "rect" && !an.sections.includes(n.label))) {
        this.#findings.push({
          label: `dangling node without a \`### \`node\`\` definition: "${n.label}" (id=${n.id})`,
          skill: name,
        });
      }
      for (const s of an.sections.filter((s) => !nodeLabels.has(s) && !diamonds.has(s))) {
        this.#findings.push({
          label: `orphan \`### \` section with no digraph node: \`${s}\``,
          skill: name,
        });
      }

      // The per-node four-element contract.
      for (const { name: nodeName, block } of an.blocks) {
        for (const [field, re] of Object.entries(ELEMENT_PATTERNS)) {
          if (!re.test(block)) {
            this.#findings.push({
              label: `node \`${nodeName}\` missing its **${field}:** element`,
              skill: name,
            });
          }
        }
      }

      // The skeleton-discipline heuristic — no standalone Rules / Red Flags headings.
      if (/^#{1,2} Rules$/m.test(an.src)) {
        this.#findings.push({ label: 'found standalone "## Rules" heading', skill: name });
      }
      if (/^#{1,2} Red Flags$/m.test(an.src)) {
        this.#findings.push({ label: 'found standalone "## Red Flags" heading', skill: name });
      }

      // The unified-skeleton family shape — the loop hub / the no-self-loop
      // exceptions (Assertion 2, §4.2: shared node names never drift across the
      // five chains).
      const row = anatomy.skills.registry[name];
      if (row !== undefined) {
        this.#familyShapeFindings(name, an, row.family, anatomy);
      }

      // The edge-condition contract (v1.20 — the label-free rule reversed) + the
      // next: route-fact consumption scan.
      this.#edgeConditionFindings(name, an, anatomy, row);
      for (const line of an.src.split("\n")) {
        const station = line.indexOf("next:");
        if (station === -1) continue;
        if (/cdd (implement|review|fix|base|schema|issue)(\s|[`"])/.test(line.slice(station))) {
          this.#findings.push({
            label: "a full command string follows the next: token on the line",
            skill: name,
          });
        }
      }

      // The author-entry bootstrap pin (§10 · the D29-regression guard): every
      // registered content-authoring entry node carries its skeleton bootstrap
      // literal — a shape-keyed strip must never remove the entry command silently.
      this.#authorBootstrapFindings(name, an, anatomy);

      // The frontmatter-validity rule (spec §4 · D42): the SKILL.md frontmatter
      // block must parse under a real YAML parser (a bare `: ` in a scalar breaks
      // it and the harness silently drops the skill — an ungated declaration).
      this.#frontmatterFindings(name, an.src, anatomy);
    }

    // The closed-set guard — the directory scan must equal the roster exactly.
    const registered = Object.keys(anatomy.skills.registry).sort();
    const discovered = [...SKILL_DIRS].sort();
    for (const name of registered.filter((name) => !discovered.includes(name))) {
      this.#findings.push({ label: `missing registered skill: ${name}`, skill: name });
    }
    for (const name of discovered.filter((name) => !registered.includes(name))) {
      this.#findings.push({ label: `unregistered skill directory: ${name}`, skill: name });
    }

    // Assertion 3 — the growth signal + the consumer-purity zero-trace rule.
    for (const name of SKILL_DIRS) {
      const skillPath = path.join(SKILLS_ROOT, name, "SKILL.md");
      const an = analyzeSkill(name, readFileSync(skillPath, "utf8"));
      const edgeKeys = new Set(an.edges.map((e) => `${e.from}|${e.label}|${e.to}`));
      const nodeCount = an.nodes.length;
      const edgeCount = edgeKeys.size;
      if (
        (nodeCount > GROWTH_NODE_LIMIT || edgeCount > GROWTH_EDGE_LIMIT) &&
        !REGISTERED_CROSSINGS.includes(name)
      ) {
        this.#findings.push({
          label: `digraph (${nodeCount} nodes · ${edgeCount} edges) crosses the growth boundary`,
          skill: name,
        });
      }
      for (const re of FORBIDDEN_HEADS) {
        if (re.test(an.src)) {
          this.#findings.push({
            label: `consumer-surface purity — the SKILL.md carries a growth/refactor narrative heading "${re.source}"`,
            skill: name,
          });
        }
      }
    }

    return this.#findings;
  }

  /** The unified-skeleton family-shape findings (§4.2) — the loop family carries
   *  the shared NEXT-LOOP hub + its single self-loop and NO handoff-* terminal (the
   *  closure routes through the engine's next face, D33); the close/onepass families
   *  are the explicit no-self-loop exceptions (cdd-close ends at the finish semantic
   *  gate + terminal · cdd-report one-shot toolchain · cdd-design forked-routing
   *  one-pass flow). */
  #familyShapeFindings(
    name: string,
    an: AnalyzedSkill,
    family: "loop" | "close" | "onepass",
    anatomy: SkillAnatomyContract,
  ): void {
    const hub = anatomy.digraph.loopHubNode.name;
    const hubNode = an.nodes.find((n) => n.label === hub);
    const hubSelfLoop =
      hubNode !== undefined && an.edges.some((e) => e.from === hubNode.id && e.to === hubNode.id);
    if (family === "loop") {
      if (hubNode === undefined) {
        this.#findings.push({ label: `missing the shared ${hub} hub`, skill: name });
      } else if (!hubSelfLoop) {
        this.#findings.push({ label: `the ${hub} hub carries no single self-loop`, skill: name });
      }
    } else {
      if (hubSelfLoop) {
        this.#findings.push({
          label: `the no-self-loop family carries a ${hub} self-loop`,
          skill: name,
        });
      }
      if (
        family === "close" &&
        !an.nodes.some((n) => n.type === "diamond" && n.label.startsWith("finish"))
      ) {
        this.#findings.push({
          label: "the close family is missing its finish semantic gate",
          skill: name,
        });
      }
    }
  }

  /** The edge-condition contract findings (v1.20 — the label-free rule reversed;
   *  D33/D35): every edge out of a decision node carries an explicit condition label;
   *  the loop family's NEXT-LOOP hub carries EXACTLY TWO out-edges (the `until next
   *  is terminal` self-loop · the `no next` BLOCKED face; no closure exit — the
   *  closure routes through the engine's next face), each label an engine-lexicon
   *  pinned phrase (edgeConditionWords — the static digraph shares ONE word table
   *  with the runtime `next:` instance). */
  #edgeConditionFindings(
    name: string,
    an: AnalyzedSkill,
    anatomy: SkillAnatomyContract,
    row: SkillRosterRow | undefined,
  ): void {
    const labelId = new Map<string, string>();
    const idLabel = new Map<string, string>();
    for (const node of an.nodes) {
      labelId.set(node.label, node.id);
      idLabel.set(node.id, node.label);
    }
    const diamondIds = new Set(an.nodes.filter((n) => n.type === "diamond").map((n) => n.id));

    // The decision-edge condition mandate — every edge out of a decision node
    // carries an explicit condition.
    for (const edge of an.edges) {
      if (diamondIds.has(edge.from) && edge.label === "") {
        this.#findings.push({
          label: `unlabeled decision edge ${edge.from} → ${edge.to}`,
          skill: name,
        });
      }
    }

    if (row === undefined || row.family !== "loop") return;

    const hub = anatomy.digraph.loopHubNode.name;
    const hubId = labelId.get(hub);
    if (hubId === undefined) return; // the missing-hub finding is the family shape's row
    const conditions = anatomy.digraph.nextLoopConditions;
    const out = an.edges.filter((e) => e.from === hubId);

    // The pinned out-edge shape + word-table pin — the loop hub's exactly the two
    // pinned out-edges.
    const selfLoop = an.edges.find((e) => e.from === hubId && e.to === hubId);
    const noNext = out.find((e) => e.label === "no next");
    if (selfLoop === undefined || selfLoop.label !== "until next is terminal") {
      this.#findings.push({
        label: `the ${hub} self-loop must carry the pinned condition label "until next is terminal"`,
        skill: name,
      });
    }
    if (noNext === undefined || !(idLabel.get(noNext.to) ?? "").startsWith("BLOCKED")) {
      this.#findings.push({
        label: `the ${hub} failure face must be the "no next" edge into the BLOCKED terminal`,
        skill: name,
      });
    }
    const expectedOut = 2;
    if (out.length !== expectedOut) {
      this.#findings.push({
        label: `the ${hub} hub carries ${out.length} out-edge(s), expected exactly the ${expectedOut} pinned`,
        skill: name,
      });
    }
    for (const edge of out) {
      if (!conditions.includes(edge.label)) {
        this.#findings.push({
          label: `the ${hub} out-edge label "${edge.label}" is outside the engine-lexicon pinned phrases`,
          skill: name,
        });
      }
    }
  }

  /** The author-entry bootstrap findings (§10 · the D29-regression guard): for each
   *  registered content-authoring entry (this skill's own entries only), the node's
   *  definition block must carry its skeleton bootstrap literal — the `schema get
   *  <type> --output skeleton <target>` entry command D29's own exception protects.
   *  A shape-keyed strip that removes the entry command from an author node fires
   *  here, never silently. */
  #authorBootstrapFindings(name: string, an: AnalyzedSkill, anatomy: SkillAnatomyContract): void {
    const re = new RegExp(anatomy.authorBootstrap.skeletonCommandPattern);
    for (const entry of anatomy.authorBootstrap.entries) {
      if (entry.skill !== name) continue;
      const block = an.blocks.find((b) => b.name === entry.node);
      if (block === undefined) {
        this.#findings.push({
          label: `the registered author-entry node \`${entry.node}\` has no definition block`,
          skill: name,
        });
      } else if (!re.test(block.block)) {
        this.#findings.push({
          label: `the author-entry node \`${entry.node}\` is missing its skeleton bootstrap literal (\`${anatomy.authorBootstrap.skeletonCommandPattern}\`)`,
          skill: name,
        });
      }
    }
  }

  /** The frontmatter-validity findings (spec §4 · D42): extract the leading
   *  `---`-fenced block and parse it with a real YAML parser; a parse failure — the
   *  `the engine's next: line` bare-colon class — is a finding (the harness would
   *  silently drop the skill). A SKILL.md with no frontmatter block is a finding
   *  too (the block is required). */
  #frontmatterFindings(name: string, src: string, anatomy: SkillAnatomyContract): void {
    const problem = SkillAnatomyCheck.frontmatterProblem(src, anatomy);
    if (problem !== null) this.#findings.push({ label: problem, skill: name });
  }

  /** The frontmatter judgment as a pure static — extracted so the gate can be
   *  exercised directly (a probe source) as well as over the live skills. Returns
   *  the finding label, or null when the frontmatter block parses. */
  static frontmatterProblem(src: string, anatomy: SkillAnatomyContract): string | null {
    const fence = anatomy.frontmatter.fence;
    const lines = src.split("\n");
    if (lines[0]?.trim() !== fence) return "the SKILL.md carries no leading frontmatter block";
    const close = lines.indexOf(fence, 1);
    if (close === -1) return "the SKILL.md frontmatter block is not closed";
    const block = lines.slice(1, close).join("\n");
    try {
      parseYaml(block);
      return null;
    } catch (err) {
      const detail = err instanceof Error ? err.message.split("\n")[0] : String(err);
      return `the SKILL.md frontmatter fails real YAML parsing — ${detail} (${anatomy.frontmatter.rule})`;
    }
  }
}

test("the kairos skills are the closed roster set — directory scan equals the contract registry", () => {
  expect(SKILL_DIRS.length).toBe(EXPECTED);
  for (const name of SKILL_DIRS) {
    expect(SKILL_ANATOMY.skills.registry[name], `unregistered skill dir: ${name}`).toBeTruthy();
  }
});

test("the six SKILL.md products pass the skill-anatomy contract (the live green face)", () => {
  const findings = new SkillAnatomyCheck().check();
  const lines = findings.map((f) => `  ${f.skill}: ${f.label}`);
  expect(lines, `anatomy findings:\n${lines.join("\n")}`).toEqual([]);
});

test("the frontmatter gate is non-vacuous — a bare-colon description is a real YAML break (D42)", () => {
  // The frontmatter defect class: a bare ASCII `: ` in an unquoted scalar makes the
  // block unparseable (the harness then silently drops the skill). The gate must fire
  // on exactly that shape — asserted through the checker's own frontmatter judgment,
  // so the live-green face is not a vacuous pass.
  const brokenSrc = [
    "---",
    "name: probe",
    "description: the engine's next: line carries the pipeline",
    "---",
    "",
    "# probe",
  ].join("\n");
  expect(SkillAnatomyCheck.frontmatterProblem(brokenSrc, SKILL_ANATOMY)).toContain(
    "fails real YAML parsing",
  );
  // The fix shape — the bare colon reworded — parses clean.
  const fixedSrc = brokenSrc.replace("the engine's next: line", "the engine's next face");
  expect(SkillAnatomyCheck.frontmatterProblem(fixedSrc, SKILL_ANATOMY)).toBeNull();
  // A SKILL.md with no frontmatter block is a finding too.
  expect(SkillAnatomyCheck.frontmatterProblem("# no frontmatter\n", SKILL_ANATOMY)).toContain(
    "no leading frontmatter",
  );
});
