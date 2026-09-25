// packages/osuperpowers/tests/digraph-consistency.test.mjs — P13 governance test + P6 E1 flow atomicity
// Single machine enforcement point (skill-authoring §8). Verifies three digraph↔node integrity assertions
// over every SKILL.md under packages/osuperpowers/skills/:
//   Assertion 1 — bidirectional completeness: digraph node set ↔ `### node` definitions mutually covering
//                 (orphans / dangling nodes fail, with named diagnostics).
//   Skeleton discipline — no standalone `## Rules` / `## Red Flags` sections.
//   Assertion 2 — skeleton isomorphism: the writing-* spec-writer trio (single / overall / phase-spec)
//                 share an identical review-loop/commit/handoff skeleton; family deltas are registered via
//                 each skill's `## Skeleton deltas` table (the validation input — an unregistered
//                 divergence fails). Membership is self-describing: any skill carrying a `## Skeleton
//                 deltas` table joins the isomorphism family.
//   Assertion 3 — growth signal + consumer purity: every skill's digraph node/edge counts are reported
//                 on each run; a digraph crossing the growth boundary (more than GROWTH_NODE_LIMIT
//                 nodes or more than GROWTH_EDGE_LIMIT edges) must have its design rationale recorded in
//                 the maintainer skill-authoring doc §9.1 registry — and NO skill's SKILL.md may carry
//                 a growth/refactor narrative heading of any form (`## Flow size note`,
//                 `## Full Flow Refactor Rationale`, … — consumer surface carries zero trace) — fails otherwise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(HERE, "..", "skills");
// Consumer-surface purity (CLAUDE.md): the growth-boundary rationale is recorded in the maintainer
// skill-authoring doc, never in a SKILL.md.
const MAINTAINER_DOC = path.resolve(HERE, "..", "..", "..", "docs", "maintainers", "06-skill-authoring.md");

// Consumer-surface purity (CLAUDE.md): SKILL.md is an instruction document — it may carry no
// growth/refactor narrative heading in any form; the whole rationale surface lives in the
// maintainer skill-authoring doc (§9.1) and the consumer surface carries zero trace of it.
const CONSUMER_GROWTH_NARRATIVE_HEADS = [/^## Flow size note$/m, /^## Full Flow Refactor Rationale$/m];

// Growth boundary (skill-authoring §9): crossing either limit requires a rationale registered in the
// maintainer doc (§9.1) — the rationale itself never ships, and no note substitutes for it.
const GROWTH_NODE_LIMIT = 15;
const GROWTH_EDGE_LIMIT = 17;

// The writing-* spec-writer trio (spec E1 — the "three brothers"): each MUST carry a `## Skeleton deltas` table and
// match the canonical review-loop/commit/handoff skeleton.
const SPEC_WRITER_TRIO = ["writing-single-spec", "writing-phase-spec", "writing-overall-spec"];

const SKILL_FILES = [];
for (const ent of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (ent.isDirectory()) {
    const p = path.join(SKILLS_DIR, ent.name, "SKILL.md");
    try { readFileSync(p); SKILL_FILES.push({ name: ent.name, path: p }); } catch {}
  }
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

// Skeleton-deltas section: rows of `| cell | cell |` between `## Skeleton deltas` and the next `## `.
function skeletonDeltaRows(src) {
  const m = src.match(/## Skeleton deltas\n([\s\S]*?)(?=\n## )/);
  if (!m) return [];
  const rows = [];
  const rowRe = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
  let r;
  while ((r = rowRe.exec(m[1])) !== null) rows.push({ key: r[1].trim(), value: r[2].trim() });
  return rows;
}

// --- Assertion 3 data: per-skill node/edge counts (printed into validate output) ----------
const counts = SKILL_FILES.map(({ name, path: skillPath }) => {
  const src = readFileSync(skillPath, "utf8");
  const { nodes, edges } = parseDigraph(src);
  const edgeKeys = new Set(edges.map((e) => `${e.from}|${e.label}|${e.to}`));
  return { name, nodes: nodes.length, edges: edgeKeys.size, ops: nodes.filter((n) => n.type === "rect").length };
});

console.log("");
console.log(
  `[digraph growth report] per-skill node/edge counts ` +
    `(boundary: >${GROWTH_NODE_LIMIT} nodes or >${GROWTH_EDGE_LIMIT} edges → rationale must be registered in maintainer docs §9.1; SKILL.md consumer surface keeps zero traces)`,
);
for (const c of counts) {
  const crosses = c.nodes > GROWTH_NODE_LIMIT || c.edges > GROWTH_EDGE_LIMIT;
  console.log(`  ${c.name}: ${c.nodes} nodes (${c.ops} ops) · ${c.edges} edges — ${crosses ? "CROSSES BOUNDARY" : "OK"}`);
}

for (const { name, path: skillPath } of SKILL_FILES) {
  const src = readFileSync(skillPath, "utf8");
  const { nodes, edges } = parseDigraph(src);
  const sections = extractSections(src);
  const diamonds = new Set(nodes.filter((n) => n.type === "diamond").map((n) => n.label));
  const nodeLabels = new Set(nodes.filter((n) => n.type === "rect").map((n) => n.label));

  // ---------- Assertion 1: bidirectional completeness --------------------------------------
  test(`[${name}] assertion 1 · every flow node has a node definition (no dangling nodes)`, () => {
    const missing = nodes.filter((n) => n.type === "rect" && !sections.includes(n.label));
    assert.deepEqual(
      missing,
      [],
      `dangling nodes without a ### \`...\` definition: ${missing.map((n) => `"${n.label}" (id=${n.id})`).join(", ")}`,
    );
  });

  test(`[${name}] assertion 1 · every node definition maps to a flow node (no orphan sections)`, () => {
    const orphans = sections.filter((s) => !nodeLabels.has(s) && !diamonds.has(s));
    assert.deepEqual(
      orphans,
      [],
      `orphan ### sections with no digraph node: ${orphans.map((s) => `\`${s}\``).join(", ")}`,
    );
  });

  // ---------- Skeleton discipline ----------------------------------------------------------
  test(`[${name}] skeleton discipline · no standalone Rules section`, () => {
    assert.ok(!/^#{1,2} Rules$/m.test(src), `${name}: found standalone "## Rules" heading`);
  });

  test(`[${name}] skeleton discipline · no standalone Red Flags section`, () => {
    assert.ok(!/^#{1,2} Red Flags$/m.test(src), `${name}: found standalone "## Red Flags" heading`);
  });

  // ---------- Assertion 2: skeleton isomorphism (writing-* spec-writer trio) ---------------
  const hasDeltasTable = /^## Skeleton deltas$/m.test(src);

  if (hasDeltasTable) {
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const edgeExists = (fromLabel, toLabel, edgeLabel) =>
      edges.some((e) => {
        const s = nodesById.get(e.from);
        const d = nodesById.get(e.to);
        if (!s || !d || s.label !== fromLabel) return false;
        const dstOk = toLabel instanceof RegExp ? toLabel.test(d.label) : d.label === toLabel;
        if (!dstOk) return false;
        return edgeLabel === "" || e.label === edgeLabel;
      });

    test(`[${name}] assertion 2 · review-loop/commit/handoff skeleton is the shared shape`, () => {
      assert.ok(nodes.some((n) => n.type === "rect" && n.label === "spec-review"), `${name}: spec-review node missing`);
      assert.ok(nodes.some((n) => n.type === "diamond" && n.label === "blocker=0?"), `${name}: blocker=0? decision missing`);
      assert.ok(nodes.some((n) => n.type === "rect" && n.label === "fix-spec"), `${name}: fix-spec node missing`);
      assert.ok(nodes.some((n) => n.type === "rect" && n.label === "commit-spec"), `${name}: commit-spec node missing`);
      assert.ok(
        nodes.some((n) => n.type === "rect" && /^handoff-/.test(n.label)),
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
      const observedHandoff = nodes.find((n) => n.type === "rect" && /^handoff-/.test(n.label))?.label;
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
    SKILL_FILES.filter(({ path: p }) => /^## Skeleton deltas$/m.test(readFileSync(p, "utf8"))).map((f) => f.name),
  );
  const missing = SPEC_WRITER_TRIO.filter((s) => !withTables.has(s));
  assert.deepEqual(missing, [], `spec-writer(s) missing the Skeleton deltas table: ${missing.join(", ")}`);
});

// ---------- Assertion 3: growth signal ------------------------------------------------------
test("assertion 3 · growth report covers every skill", () => {
  const reported = new Set(counts.map((c) => c.name));
  for (const { name } of SKILL_FILES) {
    assert.ok(reported.has(name), `growth report missing skill ${name}`);
  }
});

test("assertion 3 · crossing the growth boundary requires a maintainer-doc rationale, not a consumer note", () => {
  const maintainerSrc = readFileSync(MAINTAINER_DOC, "utf8");
  const crossed = counts.filter((c) => c.nodes > GROWTH_NODE_LIMIT || c.edges > GROWTH_EDGE_LIMIT);
  for (const c of crossed) {
    assert.ok(
      maintainerSrc.includes(`- **\`${c.name}\`**`),
      `${c.name}: digraph (${c.nodes} nodes · ${c.edges} edges) crosses the growth boundary ` +
        `(${GROWTH_NODE_LIMIT} nodes / ${GROWTH_EDGE_LIMIT} edges) — its rationale must be registered ` +
        `in the maintainer skill-authoring doc §9.1 (bullet "- **\\\`${c.name}\\\`**"); missing → FAIL`,
    );
  }
  for (const { name, path: skillPath } of SKILL_FILES) {
    const src = readFileSync(skillPath, "utf8");
    for (const re of CONSUMER_GROWTH_NARRATIVE_HEADS) {
      assert.doesNotMatch(
        src,
        re,
        `${name}: consumer surface purity (CLAUDE.md) — the SKILL.md may not carry a growth/refactor ` +
          `narrative heading (found "${re.source}"); the rationale lives in the maintainer docs §9.1`,
      );
    }
  }
});
