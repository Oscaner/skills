// packages/osuperpowers/tests/digraph-consistency.test.mjs — P13 governance test + P6 E1 flow atomicity
// Single machine enforcement point for the node-anchored SKILL.md anatomy. All structure facts come
// from the canonical skill-anatomy schema (packages/cdd-engine/src/documents/schema/skill-anatomy.json)
// — the schema is the single source; the checks below read their data (heading registry, heading
// kinds, four-element markers, growth limits, registered crossings, forbidden narrative heads) from
// it and never hard-code a structure literal. Diagnostic wording is drawn from the schema's
// descriptions. Covered assertions, per SKILL.md under packages/osuperpowers/skills/:
//   1. Section-heading STRICT allowlist (skill-anatomy sectionRegistry): every live `## ` heading is
//      one of the four public sections (Flow Digraph · Node Definitions · Invariants · Failure Modes)
//      or the two conditional sections (Skeleton deltas · Pending Acceptance Patch), the four public
//      sections are all present, conditional sections are present on their required carriers (the
//      writing-* spec-writer trio for Skeleton deltas, writing-plans for Pending Acceptance Patch),
//      and every live `### ` heading is one of the two kinds (a backticked node name or a
//      pending-patch sample `Task N:` heading) — a registry-external section/heading BLOCKS.
//   2. Assertion 1 — bidirectional completeness: digraph node set ↔ `### `node`` definitions mutually
//      covering (orphans / dangling nodes fail, with named diagnostics).
//   3. Node four-element contract (skill-anatomy nodeElements): every node definition carries the
//      Do / Read / Exit / Fail bullets.
//   4. Digraph section content (skill-anatomy digraph.mermaidOnly): `## Flow Digraph` carries exactly
//      one mermaid block and ZERO prose after it — every line after the closing fence to the next
//      `## `/`# ` heading is blank.
//   5. Skeleton discipline — no standalone `## Rules` / `## Red Flags` sections.
//   6. Assertion 2 — skeleton isomorphism: the writing-* spec-writer trio (required carriers from the
//      schema) share an identical review-loop/commit/handoff skeleton; family deltas are registered
//      via each skill's `## Skeleton deltas` table (the validation input — an unregistered
//      divergence fails). Membership is self-describing: any skill carrying a `## Skeleton deltas`
//      table joins the isomorphism family.
//   7. Assertion 3 — growth signal + consumer purity: every skill's digraph node/edge counts are
//      reported on each run; a digraph crossing the growth boundary (more than the schema's limits)
//      must have its design rationale registered in the schema's growth registry (packages/
//      cdd-engine/src/documents/schema/skill-anatomy.json) — and NO skill's SKILL.md may carry a
//      growth/refactor narrative heading of any form (`## Flow size note`, `## Full Flow Refactor
//      Rationale`, … — consumer surface carries zero trace) — fails otherwise.
// Fences (``` … ```) are sample/illustration content, never heading surface: the heading scans run
// on the fence-stripped source. Deliberate-break chains are self-built in mkdtemp (zero repo-product
// fixtures): deleted node / broken four elements / unregistered section / prose after the mermaid
// block are each intercepted by the corresponding check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(HERE, "..", "skills");

// The canonical skill-anatomy schema — the single structure fact for the node-anchored SKILL.md
// anatomy (the retired maintainer skill-authoring doc is gone). Every structure literal below is
// read from this file, never hard-coded.
const ANATOMY_PATH = path.resolve(HERE, "..", "..", "..", "packages", "cdd-engine", "src", "documents", "schema", "skill-anatomy.json");
const ANATOMY = JSON.parse(readFileSync(ANATOMY_PATH, "utf8"));

// Schema description text — the diagnostic wording the checks quote when a failure fires.
const REGISTRY_RULE = ANATOMY.properties.sectionRegistry.description;
const HEADING_KIND_RULE = ANATOMY.properties.sectionRegistry.properties.headingKinds.description;
const DIGRAPH_CONTENT_RULE = ANATOMY.properties.digraph.properties.mermaidOnly.description;
const NODE_ELEMENT_RULE = ANATOMY.properties.nodeElements.description;
const NODE_DEFINITION_RULE = ANATOMY.properties.nodeDefinitions.description;
const GROWTH_RULE = ANATOMY.properties.growthBoundary.description;
const PURITY_RULE = ANATOMY.properties.consumerPurity.description;

// The section registry + heading kinds — the strict allowlist surface (skill-anatomy sectionRegistry).
const reg = ANATOMY.properties.sectionRegistry.properties;
const PUBLIC_SECTION_KEYS = reg.public.items.enum; // ["flowDigraph","nodeDefinitions","invariants","failureModes"]
const CONDITIONAL_SECTION_KEYS = reg.conditional.items.enum; // ["skeletonDeltas","pendingAcceptancePatch"]
const SECTION_HEADINGS = Object.fromEntries(
  Object.entries(reg.sections.properties).map(([key, node]) => [key, node.properties.heading.const]),
);
// Escaped heading text + whole-line anchors, compiled from the SECTION_HEADINGS schema consts — the
// deltas-table slicer and the conditional-section gates match through these, never a hard-coded `## `.
const ESCAPED_HEADING = Object.fromEntries(
  Object.entries(SECTION_HEADINGS).map(([key, h]) => [key, h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")]),
);
const SECTION_HEADING_LINE = Object.fromEntries(
  Object.entries(ESCAPED_HEADING).map(([key, h]) => [key, new RegExp(`^${h}$`, "m")]),
);
const CONDITIONAL_CARRIERS = Object.fromEntries(
  CONDITIONAL_SECTION_KEYS.map((key) => [key, reg.sections.properties[key].properties.requiredCarriers.items.enum]),
);
const SKELETON_TRIO = CONDITIONAL_CARRIERS["skeletonDeltas"];
const NODE_HEADING_RE = new RegExp(reg.headingKinds.properties.nodeName.pattern, "m");
const PENDING_PATCH_HEADING_RE = new RegExp(reg.headingKinds.properties.pendingPatchTaskHeading.pattern, "m");

// Growth boundary + purity (skill-anatomy growthBoundary / consumerPurity) — never test literals.
const GROWTH_NODE_LIMIT = ANATOMY.properties.growthBoundary.properties.nodeLimit.const;
const GROWTH_EDGE_LIMIT = ANATOMY.properties.growthBoundary.properties.edgeLimit.const;
const REGISTERED_CROSSINGS = ANATOMY.properties.growthBoundary.properties.registry.properties.crossings.items.enum;
const FORBIDDEN_HEADS = ANATOMY.properties.consumerPurity.properties.forbiddenNarrativeHeads.items.enum.map((h) => {
  const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "m");
});

// Per-node four-element markers (skill-anatomy nodeElements) — the literal bullet forms.
const ELEMENT_PATTERNS = Object.fromEntries(
  Object.entries(ANATOMY.properties.nodeElements.properties).map(([key, node]) => [key, new RegExp(node.pattern, "m")]),
);

const SKILL_FILES = [];
for (const ent of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (ent.isDirectory()) {
    const p = path.join(SKILLS_DIR, ent.name, "SKILL.md");
    try { readFileSync(p); SKILL_FILES.push({ name: ent.name, path: p }); } catch {}
  }
}

// Fence-stripping for heading scans — ```-fenced blocks (mermaid + sample illustrations) are code,
// never live heading surface; blanking the block preserves line numbers for diagnostics.
function stripFences(src) {
  return src.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*\n?/gm, (m) => m.replace(/[^\n]/g, ""));
}

function parseDigraph(src) {
  const m = src.match(/```mermaid\n([\s\S]*?)```/);
  if (!m) return { nodes: [], edges: [] };
  const block = m[1];
  const nodes = [];
  const seen = new Set();
  // A[label] / A{label} / A((label)) — re-declarations (e.g. `G --> C[author-spec]`) keep the first id
  const nodeRe = /(\w+)\[([^\]]+)\]|(\w+)\{([^}]+)\}|(\w+)\(\(([^)]+)\)\)/g;
  let mm;
  while ((mm = nodeRe.exec(block)) !== null) {
    const id = mm[1] || mm[3] || mm[5];
    const label = (mm[2] ?? mm[4] ?? mm[6] ?? "").trim();
    const type = mm[2] !== undefined ? "rect" : mm[4] !== undefined ? "diamond" : "terminal";
    if (seen.has(id)) continue; // re-declaration (e.g. `G --> C[author-spec]` keeps C's identity)
    seen.add(id);
    nodes.push({ id, type, label });
  }
  const edges = [];
  // source id may carry its declaration token (`A[detect-engine] -->|found| B`) — the bracketed form must be counted too
  const edgeRe = /(\w+)(?:\[[^\]]*\]|\{[^}]*\}|\(\([^)]*\)\))?\s*-->\s*(?:\|([^|]*)\|)?\s*(\w+)/g;
  let em;
  while ((em = edgeRe.exec(block)) !== null) {
    edges.push({ from: em[1], label: (em[2] || "").trim(), to: em[3] });
  }
  return { nodes, edges };
}

function extractSections(src) {
  const re = /^### `([^`]+)`/gm;
  const sections = [];
  let m;
  while ((m = re.exec(src)) !== null) sections.push(m[1]);
  return sections;
}

// Skeleton-deltas section: rows of `| cell | cell |` between the Skeleton deltas heading and the next `## `.
function skeletonDeltaRows(src) {
  const m = src.match(new RegExp(`${ESCAPED_HEADING.skeletonDeltas}\n([\\s\\S]*?)(?=\n## )`));
  if (!m) return [];
  const rows = [];
  const rowRe = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
  let r;
  while ((r = rowRe.exec(m[1])) !== null) rows.push({ key: r[1].trim(), value: r[2].trim() });
  return rows;
}

// The `## Flow Digraph` section, sliced from the literal heading to the next `#`/`##` heading.
function digraphSection(src) {
  const start = src.indexOf(SECTION_HEADINGS.flowDigraph);
  if (start === -1) return { mermaid: null, trailing: "" };
  const afterHeading = src.slice(start + SECTION_HEADINGS.flowDigraph.length);
  const relEnd = afterHeading.search(/\n#{1,3} /);
  const sectionText = relEnd === -1 ? afterHeading : afterHeading.slice(0, relEnd);
  const open = sectionText.indexOf("```mermaid");
  const close = open === -1 ? -1 : sectionText.indexOf("```", open + "```mermaid".length);
  const mermaid = open !== -1 && close !== -1 ? sectionText.slice(open, close + 3) : null;
  const trailing = close === -1 ? sectionText : sectionText.slice(close + 3);
  return { mermaid, trailing };
}

// Per-node definition blocks (from a `### `node`` heading to the next heading line).
function nodeBlocks(src) {
  const blocks = [];
  const re = /^### `([^`]+)`/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const rest = src.slice(m.index + m[0].length);
    const relEnd = rest.search(/\n(?=#{1,3} )/);
    blocks.push({ name: m[1], block: relEnd === -1 ? rest : rest.slice(0, relEnd) });
  }
  return blocks;
}

// One skill fully analyzed — every check below consumes this structure (shared by the live-skill
// assertions and the mkdtemp deliberate-break chains, so the same code intercepts both).
function analyzeSkill(name, src) {
  const stripped = stripFences(src);
  return {
    name,
    src,
    stripped,
    headings: {
      h2: [...stripped.matchAll(/^## [^\n]*$/gm)].map((mm) => mm[0].trim()),
      h3: [...stripped.matchAll(/^### [^\n]*$/gm)].map((mm) => mm[0].trim()),
    },
    digraph: digraphSection(src),
    nodes: parseDigraph(src).nodes,
    edges: parseDigraph(src).edges,
    sections: extractSections(src),
    blocks: nodeBlocks(src),
  };
}

// --- Finding collectors: each returns a list of { category, message } — empty = pass. -------------

function registryFindings(an) {
  const out = [];
  const known = new Set(Object.values(SECTION_HEADINGS));
  const unknown = an.headings.h2.filter((h) => !known.has(h));
  if (unknown.length > 0) {
    out.push({
      category: "registry-h2-external",
      message: `${an.name}: unregistered \`## \` heading(s): ${unknown.map((h) => `"${h}"`).join(", ")} — ${REGISTRY_RULE}`,
    });
  }
  const missingPublic = PUBLIC_SECTION_KEYS.filter((key) => !an.headings.h2.includes(SECTION_HEADINGS[key]));
  if (missingPublic.length > 0) {
    out.push({
      category: "registry-h2-missing-public",
      message: `${an.name}: missing public section(s): ${missingPublic.map((k) => `\`${SECTION_HEADINGS[k]}\``).join(", ")} — ${REGISTRY_RULE}`,
    });
  }
  for (const key of CONDITIONAL_SECTION_KEYS) {
    if (CONDITIONAL_CARRIERS[key].includes(an.name) && !an.headings.h2.includes(SECTION_HEADINGS[key])) {
      out.push({
        category: "registry-h2-missing-conditional",
        message: `${an.name}: required conditional section \`${SECTION_HEADINGS[key]}\` missing (carrier of a conditional section) — ${REGISTRY_RULE}`,
      });
    }
  }
  const badH3 = an.headings.h3.filter((h) => !NODE_HEADING_RE.test(h) && !PENDING_PATCH_HEADING_RE.test(h));
  if (badH3.length > 0) {
    out.push({
      category: "registry-h3-external",
      message: `${an.name}: unregistered \`### \` heading(s): ${badH3.map((h) => `"${h}"`).join(", ")} — ${HEADING_KIND_RULE}`,
    });
  }
  return out;
}

function digraphContentFindings(an) {
  const out = [];
  if (an.digraph.mermaid === null) {
    out.push({
      category: "digraph-mermaid-missing",
      message: `${an.name}: \`${SECTION_HEADINGS.flowDigraph}\` carries no mermaid block — ${DIGRAPH_CONTENT_RULE}`,
    });
    return out;
  }
  if (an.digraph.trailing.trim() !== "") {
    out.push({
      category: "digraph-prose-after-mermaid",
      message: `${an.name}: prose after the mermaid block ("${an.digraph.trailing.trim().split("\n")[0]}") — ${DIGRAPH_CONTENT_RULE}`,
    });
  }
  return out;
}

function elementFindings(an) {
  const out = [];
  for (const { name, block } of an.blocks) {
    for (const [field, re] of Object.entries(ELEMENT_PATTERNS)) {
      if (!re.test(block)) {
        out.push({
          category: `node-missing-${field}`,
          message: `${an.name}: node \`${name}\` missing its **${field}:** element — ${NODE_ELEMENT_RULE}`,
        });
      }
    }
  }
  return out;
}

function coverageFindings(an) {
  const out = [];
  const nodeLabels = new Set(an.nodes.filter((n) => n.type === "rect").map((n) => n.label));
  const diamonds = new Set(an.nodes.filter((n) => n.type === "diamond").map((n) => n.label));
  const missing = an.nodes.filter((n) => n.type === "rect" && !an.sections.includes(n.label));
  if (missing.length > 0) {
    out.push({
      category: "digraph-dangling-node",
      message: `${an.name}: dangling nodes without a \`### \`node\`\` definition: ${missing.map((n) => `"${n.label}" (id=${n.id})`).join(", ")} — ${NODE_DEFINITION_RULE}`,
    });
  }
  const orphans = an.sections.filter((s) => !nodeLabels.has(s) && !diamonds.has(s));
  if (orphans.length > 0) {
    out.push({
      category: "digraph-orphan-section",
      message: `${an.name}: orphan \`### \` sections with no digraph node: ${orphans.map((s) => `\`${s}\``).join(", ")} — ${NODE_DEFINITION_RULE}`,
    });
  }
  return out;
}

function disciplineFindings(an) {
  const out = [];
  if (/^#{1,2} Rules$/m.test(an.src)) out.push({ category: "standalone-rules", message: `${an.name}: found standalone "## Rules" heading` });
  if (/^#{1,2} Red Flags$/m.test(an.src)) out.push({ category: "standalone-red-flags", message: `${an.name}: found standalone "## Red Flags" heading` });
  return out;
}

// --- Assertion 3 data: per-skill node/edge counts (printed into validate output) ----------
const counts = SKILL_FILES.map(({ name, path: skillPath }) => {
  const an = analyzeSkill(name, readFileSync(skillPath, "utf8"));
  const edgeKeys = new Set(an.edges.map((e) => `${e.from}|${e.label}|${e.to}`));
  return { name, nodes: an.nodes.length, edges: edgeKeys.size, ops: an.nodes.filter((n) => n.type === "rect").length };
});

console.log("");
console.log(
  `[digraph growth report] per-skill node/edge counts ` +
    `(boundary: >${GROWTH_NODE_LIMIT} nodes or >${GROWTH_EDGE_LIMIT} edges → rationale must be registered ` +
    `in the skill-anatomy schema growth registry; SKILL.md consumer surface keeps zero traces)`,
);
for (const c of counts) {
  const crosses = c.nodes > GROWTH_NODE_LIMIT || c.edges > GROWTH_EDGE_LIMIT;
  console.log(`  ${c.name}: ${c.nodes} nodes (${c.ops} ops) · ${c.edges} edges — ${crosses ? "CROSSES BOUNDARY" : "OK"}`);
}

for (const { name, path: skillPath } of SKILL_FILES) {
  const an = analyzeSkill(name, readFileSync(skillPath, "utf8"));
  const src = an.src;

  // ---------- Strict section-heading allowlist (skill-anatomy sectionRegistry) -----------------
  test(`[${name}] allowlist · every live \`## \` heading is in the section registry and the four public sections are present`, () => {
    const f = registryFindings(an).filter((x) => x.category === "registry-h2-external" || x.category === "registry-h2-missing-public");
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  test(`[${name}] allowlist · conditional section present on its required carrier`, () => {
    const f = registryFindings(an).filter((x) => x.category === "registry-h2-missing-conditional");
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  test(`[${name}] allowlist · every live \`### \` heading is a backticked node name or a pending-patch sample`, () => {
    const f = registryFindings(an).filter((x) => x.category === "registry-h3-external");
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  // ---------- Digraph section content (skill-anatomy digraph.mermaidOnly) ----------------------
  test(`[${name}] digraph section · exactly one mermaid block, zero prose after it`, () => {
    const f = digraphContentFindings(an);
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  // ---------- Assertion 1: bidirectional completeness ------------------------------------------
  test(`[${name}] assertion 1 · every flow node has a node definition (no dangling nodes)`, () => {
    const f = coverageFindings(an).filter((x) => x.category === "digraph-dangling-node");
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  test(`[${name}] assertion 1 · every node definition maps to a flow node (no orphan sections)`, () => {
    const f = coverageFindings(an).filter((x) => x.category === "digraph-orphan-section");
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  // ---------- Node four-element contract (skill-anatomy nodeElements) ---------------------------
  test(`[${name}] node anatomy · every node definition carries the Do / Read / Exit / Fail elements`, () => {
    const f = elementFindings(an);
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  // ---------- Skeleton discipline ---------------------------------------------------------------
  test(`[${name}] skeleton discipline · no standalone Rules section`, () => {
    const f = disciplineFindings(an).filter((x) => x.category === "standalone-rules");
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  test(`[${name}] skeleton discipline · no standalone Red Flags section`, () => {
    const f = disciplineFindings(an).filter((x) => x.category === "standalone-red-flags");
    assert.deepEqual(f, [], f.map((x) => x.message).join("\n"));
  });

  // ---------- Assertion 2: skeleton isomorphism (writing-* spec-writer trio) -------------------
  const hasDeltasTable = SECTION_HEADING_LINE.skeletonDeltas.test(src);

  if (hasDeltasTable) {
    const nodesById = new Map(an.nodes.map((n) => [n.id, n]));
    const edgeExists = (fromLabel, toLabel, edgeLabel) =>
      an.edges.some((e) => {
        const s = nodesById.get(e.from);
        const d = nodesById.get(e.to);
        if (!s || !d || s.label !== fromLabel) return false;
        const dstOk = toLabel instanceof RegExp ? toLabel.test(d.label) : d.label === toLabel;
        if (!dstOk) return false;
        return edgeLabel === "" || e.label === edgeLabel;
      });

    test(`[${name}] assertion 2 · review-loop/commit/handoff skeleton is the shared shape`, () => {
      assert.ok(an.nodes.some((n) => n.type === "rect" && n.label === "spec-review"), `${name}: spec-review node missing`);
      assert.ok(an.nodes.some((n) => n.type === "diamond" && n.label === "blocker=0?"), `${name}: blocker=0? decision missing`);
      assert.ok(an.nodes.some((n) => n.type === "rect" && n.label === "fix-spec"), `${name}: fix-spec node missing`);
      assert.ok(an.nodes.some((n) => n.type === "rect" && n.label === "commit-spec"), `${name}: commit-spec node missing`);
      assert.ok(
        an.nodes.some((n) => n.type === "rect" && /^handoff-/.test(n.label)),
        `${name}: handoff-* node missing`,
      );
      assert.ok(edgeExists("spec-review", "blocker=0?", ""), `${name}: spec-review → blocker=0? edge missing`);
      // Family canon (plan Task 9 is the single-arrow shape {blocker=0?} → [fix]; the trio draws both labeled
      // yes/no arms — their drawing choice). edgeExists(label "") matches yes / no / unlabeled, so either
      // convention satisfies the shared skeleton; revisit when Task 9 lands the cli-driven-development canon.
      assert.ok(edgeExists("blocker=0?", "fix-spec", ""), `${name}: blocker=0? → fix-spec edge missing`);
      assert.ok(
        edgeExists("fix-spec", "spec-review", "entered via blocker>0"),
        `${name}: fix-spec --entered via blocker>0--> spec-review back-edge missing`,
      );
      assert.ok(
        edgeExists("fix-spec", "commit-spec", "entered via blocker=0"),
        `${name}: fix-spec --entered via blocker=0--> commit-spec edge missing`,
      );
      assert.ok(edgeExists("commit-spec", /^handoff-/, ""), `${name}: commit-spec → handoff-* edge missing`);
    });

    test(`[${name}] assertion 2 · skeleton deltas table registers the handoff delta (validation input)`, () => {
      const rows = skeletonDeltaRows(src);
      const observedHandoff = an.nodes.find((n) => n.type === "rect" && /^handoff-/.test(n.label))?.label;
      const handoffRow = rows.find((r) => r.key.toLowerCase().includes("handoff"));
      assert.ok(handoffRow, `${name}: Skeleton deltas table has no "handoff-spec" row (unregistered handoff)`);
      const declared = handoffRow.value.match(/`([^`]+)`/);
      assert.ok(declared, `${name}: handoff-spec row declares no backticked node name`);
      assert.equal(
        declared[1],
        observedHandoff,
        `${name}: digraph handoff node "${observedHandoff}" differs from the registered "${declared[1]}" (update the Skeleton deltas table)`,
      );
    });

    test(`[${name}] assertion 2 · skeleton deltas table declares the shared review-loop shape`, () => {
      const rows = skeletonDeltaRows(src);
      const loopRow = rows.find((r) => r.key.toLowerCase().includes("review loop"));
      assert.ok(loopRow, `${name}: Skeleton deltas table has no "review loop" row — the shared skeleton must be declared`);
      assert.ok(
        /shared shape|no delta/i.test(loopRow.value),
        `${name}: review-loop row does not declare the shared shape ("${loopRow.value}")`,
      );
    });
  }
}

// ---------- Assertion 2 family guard: every spec-writer MUST carry the deltas table ---------
test("assertion 2 · spec-writer trio all carry a ## Skeleton deltas table (deltas = validation input)", () => {
  const withTables = new Set(
    SKILL_FILES.filter(({ path: p }) => SECTION_HEADING_LINE.skeletonDeltas.test(readFileSync(p, "utf8"))).map((f) => f.name),
  );
  const missing = SKELETON_TRIO.filter((s) => !withTables.has(s));
  assert.deepEqual(missing, [], `spec-writer(s) missing the Skeleton deltas table: ${missing.join(", ")} — ${REGISTRY_RULE}`);
});

// ---------- Assertion 3: growth signal ----------------------------------------------------------
test("assertion 3 · growth report covers every skill", () => {
  const reported = new Set(counts.map((c) => c.name));
  for (const { name } of SKILL_FILES) {
    assert.ok(reported.has(name), `growth report missing skill ${name}`);
  }
});

test("assertion 3 · crossing the growth boundary requires a schema-registry rationale, not a consumer note", () => {
  const crossed = counts.filter((c) => c.nodes > GROWTH_NODE_LIMIT || c.edges > GROWTH_EDGE_LIMIT);
  for (const c of crossed) {
    assert.ok(
      REGISTERED_CROSSINGS.includes(c.name),
      `${c.name}: digraph (${c.nodes} nodes · ${c.edges} edges) crosses the growth boundary ` +
        `(${GROWTH_NODE_LIMIT} nodes / ${GROWTH_EDGE_LIMIT} edges) — its rationale must be registered ` +
        `in the skill-anatomy schema growth registry (crossings list); missing → FAIL — ${GROWTH_RULE}`,
    );
  }
  for (const { name, path: skillPath } of SKILL_FILES) {
    const src = readFileSync(skillPath, "utf8");
    for (const re of FORBIDDEN_HEADS) {
      assert.doesNotMatch(
        src,
        re,
        `${name}: consumer surface purity — the SKILL.md may not carry a growth/refactor narrative ` +
          `heading (found "${re.source}"); the rationale lives in the skill-anatomy schema growth ` +
          `registry, and the consumer surface carries zero trace — ${PURITY_RULE}`,
      );
    }
  }
});

// ---------- Deliberate-break chains: mkdtemp self-built fixtures, intercepted ----------------
// A minimal-but-valid synthetic skill (all checks green on its own — the control) and four broken
// variants. Built in mkdtemp dirs (zero repo-product fixtures): a deleted node, a missing node
// element, an unregistered section, and prose after the mermaid block each must be intercepted by
// the corresponding check — the anti-white-green proof that the schema-driven checks fire.
const BASE_SKILL = `# Synthetic Skill

## Flow Digraph

\`\`\`mermaid
flowchart TD
  A[run-thing] --> B{ok?}
  B -->|yes| C((APPROVED))
  B -->|no| D((BLOCKED: nope))
\`\`\`

## Node Definitions

### \`run-thing\`

- **Do**: Do the thing.
- **Read**: input
- **Exit**: ok? → \`ok?\`
- **Fail**: failure → fail-open

### \`ok?\`

- **Do**: Decide.
- **Read**: output
- **Exit**: yes → APPROVED; no → BLOCKED
- **Fail**: —

## Invariants

| # | Invariant |
|---|---|
| I1 | Keep it simple. |

## Failure Modes

| failure | behavior |
|---|---|
| nope | BLOCKED (no silent fallback) |
`;

const BREAK_CASES = [
  {
    kind: "deleted-node",
    expect: /^digraph-(dangling-node|orphan-section)$/,
    make: (s) => s.replace(/### `run-thing`[\s\S]*?(?=\n### |\n## )/, "\n"),
  },
  {
    kind: "broken-four-elements",
    expect: /^node-missing-/,
    make: (s) => s.replace("- **Do**: Do the thing.\n", ""),
  },
  {
    kind: "unregistered-section",
    expect: /^registry-/,
    make: (s) => s + "\n## Flow size note\n\nNarration that never ships.\n",
  },
  {
    kind: "digraph-prose",
    expect: /^digraph-prose-after-mermaid$/,
    make: (s) => s.replace("```\n\n## Node Definitions", "```\n\n7 process steps / 2 nodes.\n\n## Node Definitions"),
  },
];

function interceptingFindings(an, categoryRe) {
  const all = [
    ...coverageFindings(an),
    ...registryFindings(an),
    ...digraphContentFindings(an),
    ...elementFindings(an),
    ...disciplineFindings(an),
  ];
  return categoryRe === "any" ? all : all.filter((f) => categoryRe.test(f.category));
}

test("mkdtemp deliberate-break chains: a synthetic base skill passes every schema-driven check (control)", () => {
  const an = analyzeSkill("synthetic-control", BASE_SKILL);
  const hits = interceptingFindings(an, "any");
  assert.deepEqual(hits, [], hits.map((x) => x.message).join("\n"));
});

test("mkdtemp deliberate-break chains: deleted node / broken four elements / unregistered section / digraph prose are each intercepted", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "skill-anatomy-break-"));
  try {
    for (const c of BREAK_CASES) {
      const file = path.join(dir, `${c.kind}.md`);
      writeFileSync(file, c.make(BASE_SKILL));
      const an = analyzeSkill(`synthetic-${c.kind}`, readFileSync(file, "utf8"));
      const hits = interceptingFindings(an, c.expect);
      assert.ok(
        hits.length > 0,
        `synthetic-${c.kind}: expected the ${c.expect} check to intercept the deliberate break — none fired`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
