// packages/osuperpowers/tests/digraph-consistency.test.mjs — P13 governance test
// Verifies skill-authoring §8 four checklists: node coverage, section alignment,
// no standalone Rules, no standalone Red Flags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(HERE, "..", "skills");

// Find all SKILL.md files (exclude init — legacy exemption per skill-authoring §7)
import { readdirSync } from "node:fs";

const SKILL_FILES = [];
for (const ent of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (ent.isDirectory() && ent.name !== "init") {
    const p = path.join(SKILLS_DIR, ent.name, "SKILL.md");
    try { readFileSync(p); SKILL_FILES.push({ name: ent.name, path: p }); } catch {}
  }
}

function extractMermaidNodes(src) {
  const m = src.match(/```mermaid\n([\s\S]*?)```/);
  if (!m) return [];
  const block = m[1];
  // Match node definitions: A[name] / A{Name?} / A((name)) / A(("name"))
  const nodeRe = /(\w+)\[([^\]]+)\]|(\w+)\{([^}]+)\}|(\w+)\(\(([^)]+)\)\)/g;
  const nodes = [];
  let match;
  while ((match = nodeRe.exec(block)) !== null) {
    const id = match[1] || match[3] || match[5];
    const label = match[2] || match[4] || match[6];
    // Skip terminal nodes (rounded double-circle): ((...))
    // Skip decision diamonds: {label} — flow-routing, not process steps
    const isTerminal = match[5] !== undefined;
    const isDecision = match[3] !== undefined;
    if (!isTerminal && !isDecision && id) nodes.push({ id, label: label.trim() });
  }
  return nodes;
}

function extractSections(src) {
  const re = /^### `([^`]+)`/gm;
  const sections = [];
  let m;
  while ((m = re.exec(src)) !== null) sections.push(m[1]);
  return sections;
}

for (const { name, path: skillPath } of SKILL_FILES) {
  const src = readFileSync(skillPath, "utf8");

  test(`[${name}] node coverage: every mermaid node has a ### section`, () => {
    const nodes = extractMermaidNodes(src);
    const sections = extractSections(src);
    for (const node of nodes) {
      assert.ok(
        sections.includes(node.label),
        `Node "${node.label}" (id=${node.id}) has no ### \`${node.label}\` section`
      );
    }
  });

  test(`[${name}] section alignment: every ### section has a mermaid node`, () => {
    const nodes = extractMermaidNodes(src);
    const nodeLabels = new Set(nodes.map(n => n.label));
    // Also collect decision diamond labels (skipped in node coverage but may have sections)
    const m = src.match(/```mermaid\n([\s\S]*?)```/);
    const diamondLabels = new Set();
    if (m) {
      const block = m[1];
      const diamondRe = /(\w+)\{([^}]+)\}/g;
      let dm;
      while ((dm = diamondRe.exec(block)) !== null) {
        diamondLabels.add(dm[2].trim());
      }
    }
    const sections = extractSections(src);
    for (const sec of sections) {
      assert.ok(
        nodeLabels.has(sec) || diamondLabels.has(sec),
        `Section ### \`${sec}\` has no corresponding mermaid node`
      );
    }
  });

  test(`[${name}] no standalone Rules section`, () => {
    assert.ok(!/^#{1,2} Rules$/m.test(src), `${name}: found standalone "## Rules" heading`);
  });

  test(`[${name}] no standalone Red Flags section`, () => {
    assert.ok(!/^#{1,2} Red Flags$/m.test(src), `${name}: found standalone "## Red Flags" heading`);
  });
}
