// packages/osuperpowers/tests/rule-reference.test.mjs — Node port of
// rule-reference.test.py (semantic mode, issue #52 Guard 2).
//
// Guards rule-name integrity across the osuperpowers SKILL.md files:
//   - rule headings are `### Rule: <Semantic Name>` (level-3 only, so
//     `#### <Name>` subheadings never register as rule IDs);
//   - inline `Rule: <Name>` refs must resolve to a same-file heading;
//   - cross-file refs use markdown links `[Rule: <Name>](../<skill>/SKILL.md
//     #rule-<kebab>)` whose target skill has that heading AND whose
//     `#rule-<kebab>` fragment is the kebab slug of the rule name;
//   - cross-doc links carrying a `#rule-<kebab>` anchor must resolve to a
//     heading slug in the target file (SKILL.md or any `.md` under the repo).
//
// Unlike the .py it is a pure node:test suite (no standalone CLI): the real
// scan of `packages/osuperpowers/skills` is itself a test case, so the guard
// runs wherever the suite is invoked (`node --test rule-reference.test.mjs`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// tests/ → osuperpowers/ → packages/ → repo root (three levels post packages/ layout)
export const REPO_ROOT = path.resolve(HERE, "../../..");
const ENGINE_SKILLS = path.join(REPO_ROOT, "packages/osuperpowers/skills");

export const DEFAULT_SKILLS = [["packages/osuperpowers/skills", "semantic"]];

// --- regexes (semantic mode; port of the .py) ---
// Rule headings are `### Rule: <Name>` — exactly level-3, so `#### <Name>` (or
// `#### Rule: <Name>`) subheadings never register as top-level rule IDs.
const HEAD_SEM = /^### Rule: ([A-Z][A-Za-z0-9 -]*?)\s*$/;
// Inline `Rule: <Name>` ref. Names are capitalized runs (letters/digits/hyphens/
// spaces); the match stops at the first char outside that class or at EOL, which
// keeps `Rule: Empty list（…）` and `Rule: One-shot Free-Form）` whole.
const REF_SEM = /Rule: ([A-Z][A-Za-z0-9 -]*?)(?=[^A-Za-z0-9 -]|$)/g;
// Cross-file semantic ref: [Rule: <Name>](<path>/SKILL.md[#rule-<kebab>])
const LINK_HAS_REF_SEM = /\[Rule: ([A-Z][A-Za-z0-9 -]*?)\]\(([^)]*SKILL\.md[^)]*)\)/g;
// Any markdown link URL (cross-doc #rule-<kebab> anchor resolution)
const LINK_URL = /\[[^\]]*\]\(([^)]+)\)/g;
const RULE_FRAG = /^rule-[a-z0-9-]+$/;
const HEAD_ANY = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const COMMENT = /^\s*<!--/;

// --- helpers ---

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// `url.partition("#")` from the .py — path before the first `#`, everything
// after it as the fragment (a second `#` stays in the fragment).
function partitionHash(url) {
  const i = url.indexOf("#");
  return i === -1 ? [url, ""] : [url.slice(0, i), url.slice(i + 1)];
}

export function slugify(text) {
  // GitHub-style anchor slug. Rule headings are ASCII; CJK/other punctuation is
  // dropped so e.g. `### Rule: Return Block` -> `rule-return-block`.
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function headingAnchors(filePath) {
  // Set of heading-slug anchors present in a markdown file (all levels).
  const anchors = new Set();
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return anchors;
  }
  for (const line of text.split("\n")) {
    const m = HEAD_ANY.exec(line);
    if (m) anchors.add(slugify(m[1]));
  }
  return anchors;
}

export function buildIndexSemantic(skillsDir) {
  const idx = {};
  for (const ent of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const filePath = path.join(skillsDir, ent.name, "SKILL.md");
    if (!isFile(filePath)) continue;
    const ids = new Set();
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
      const m = HEAD_SEM.exec(line);
      if (m) ids.add(m[1].trim());
    }
    idx[ent.name] = ids;
  }
  return idx;
}

function resolveLink(url, curDir, skillsDir) {
  // strip the #rule-<kebab> fragment before path resolution
  const [pathPart] = partitionHash(url);
  const target = path.normalize(path.join(curDir, pathPart));
  const rel = path.relative(skillsDir, target);
  // target under skillsDir (commonpath check from the .py; empty rel = target
  // IS skillsDir, which is never a file, so it resolves to non-sibling).
  const underSkills = rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  if (underSkills && isFile(target)) {
    return [path.basename(path.dirname(target)), true];
  }
  return [null, false];
}

function insideLink(start, end, linkMatches) {
  return linkMatches.some((lm) => lm.index <= start && end <= lm.index + lm[0].length);
}

export function scanSemantic(skillsDir, idx) {
  const problems = [];
  const names = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const name of names) {
    const filePath = path.join(skillsDir, name, "SKILL.md");
    if (!isFile(filePath)) continue;
    const curDir = path.dirname(filePath);
    const lines = readFileSync(filePath, "utf8").split("\n");
    lines.forEach((line, i) => {
      const lineno = i + 1;
      if (HEAD_SEM.test(line) || COMMENT.test(line)) return;
      // 1. cross-file markdown links: [Rule: <Name>](<url>SKILL.md...)
      const linkMatches = [...line.matchAll(LINK_HAS_REF_SEM)];
      for (const lm of linkMatches) {
        const refName = lm[1].trim();
        const url = lm[2];
        const [tname, isSibling] = resolveLink(url, curDir, skillsDir);
        if (isSibling && !idx[tname].has(refName)) {
          problems.push(`${name}:${lineno}: Rule: ${refName} -> ${tname} lacks heading`);
        }
        // anchor contract: the #rule-<kebab> fragment on a cross-skill
        // [Rule: <Name>] link must be the kebab slug of the rule name, so the
        // anchor cannot silently point at a *different* rule in the same file
        // (both headings exist, so the bare anchor check in step 3 can't catch it).
        const [, frag] = partitionHash(url);
        if (isSibling && frag && RULE_FRAG.test(frag) && frag !== `rule-${slugify(refName)}`) {
          problems.push(
            `${name}:${lineno}: Rule: ${refName} -> ${tname}#${frag} anchor mismatch (want rule-${slugify(refName)})`,
          );
        }
      }
      // 2. bare same-file references (skip refs that are the link text above)
      for (const m of line.matchAll(REF_SEM)) {
        if (insideLink(m.index, m.index + m[0].length, linkMatches)) continue;
        const refName = m[1].trim();
        if (refName && !idx[name].has(refName)) {
          problems.push(`${name}:${lineno}: Rule: ${refName} dangling (no heading in ${name})`);
        }
      }
      // 3. cross-doc `#rule-<kebab>` anchors must resolve to a heading slug in
      // the target file — covers both SKILL.md links and doc links. Missing
      // target files are tolerated, matching the lenient handling in step 1.
      for (const lm of line.matchAll(LINK_URL)) {
        const url = lm[1].trim();
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:") || url.startsWith("#")) continue;
        const [pathPart, frag] = partitionHash(url);
        if (!RULE_FRAG.test(frag)) continue;
        const target = path.normalize(path.join(curDir, pathPart));
        if (!isFile(target)) continue;
        if (!headingAnchors(target).has(frag)) {
          const rel = path.relative(REPO_ROOT, target);
          problems.push(`${name}:${lineno}: #rule anchor ${frag} not found in ${rel}`);
        }
      }
    });
  }
  return problems;
}

// --- self-test fixtures (port of the .py self_test; the .py built these in a
// temp dir and asserted on the problem list — here each scenario is a test) ---

test("slugify: GitHub-style anchor slugs", () => {
  assert.equal(slugify("Return Block"), "return-block");
  assert.equal(slugify("Empty list（…）"), "empty-list");
  assert.equal(slugify("One-shot Free-Form"), "one-shot-free-form");
});

test("semantic: same-file dangling + cross-file refs resolved", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "rule-ref-sem-"));
  try {
    mkdirSync(path.join(tmp, "cli-aaa"), { recursive: true });
    mkdirSync(path.join(tmp, "cli-bbb"), { recursive: true });
    writeFileSync(path.join(tmp, "cli-aaa", "SKILL.md"),
      "---\nname: cli-aaa\n---\n\n### Rule: Alpha\n\nBody references Rule: Beta（dangling）.\n");
    writeFileSync(path.join(tmp, "cli-bbb", "SKILL.md"),
      "---\nname: cli-bbb\n---\n\n### Rule: Gamma\n\nSee [Rule: Alpha](../cli-aaa/SKILL.md#rule-alpha) and Rule: Delta（missing）.\n");
    const idx = buildIndexSemantic(tmp);
    const problems = scanSemantic(tmp, idx);
    assert.ok(problems.some((p) => p.includes("Rule: Beta")), `semantic same-file dangling not caught: ${problems}`);
    assert.ok(problems.some((p) => p.includes("Rule: Delta")), `semantic bare dangling not caught: ${problems}`);
    assert.ok(
      !problems.some((p) => p.includes("Rule: Alpha") && p.includes("cli-aaa lacks heading")),
      `semantic valid cross-ref flagged: ${problems}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("semantic: cross-doc #rule anchor resolution", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "rule-ref-anchor-"));
  try {
    mkdirSync(path.join(tmp, "cli-aaa"), { recursive: true });
    mkdirSync(path.join(tmp, "docs"), { recursive: true });
    writeFileSync(path.join(tmp, "docs", "controller-handoff.md"), "### Rule: Return Block\n\nBody.\n");
    writeFileSync(path.join(tmp, "cli-aaa", "SKILL.md"),
      "---\nname: cli-aaa\n---\n\nSee [Return Block](../docs/controller-handoff.md#rule-return-block) and [Missing](../docs/controller-handoff.md#rule-missing).\n");
    const idx = buildIndexSemantic(tmp);
    const problems = scanSemantic(tmp, idx);
    assert.ok(!problems.some((p) => p.includes("rule-return-block")), `valid doc anchor flagged: ${problems}`);
    assert.ok(problems.some((p) => p.includes("rule-missing")), `missing doc anchor not caught: ${problems}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("semantic: cross-skill anchor-name mismatch caught (model)", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "rule-ref-model-"));
  try {
    for (const sub of ["cli-aaa", "aaa", "bbb", "docs"]) {
      mkdirSync(path.join(tmp, sub), { recursive: true });
    }
    writeFileSync(path.join(tmp, "docs", "controller-handoff.md"), "### Rule: Return Block\n\nBody.\n");
    writeFileSync(path.join(tmp, "cli-aaa", "SKILL.md"),
      "---\nname: cli-aaa\n---\n\n### Rule: Ask\n\n### Rule: Detect\n\nBody.\n");
    writeFileSync(path.join(tmp, "aaa", "SKILL.md"),
      "---\nname: aaa\n---\n\nSee [Rule: Ask](../cli-aaa/SKILL.md#rule-ask) and [Return Block](../../docs/controller-handoff.md#rule-return-block).\n");
    writeFileSync(path.join(tmp, "bbb", "SKILL.md"),
      "---\nname: bbb\n---\n\nSee [Rule: Ask](../cli-aaa/SKILL.md#rule-detect).\n");
    const idx = buildIndexSemantic(tmp);
    const problems = scanSemantic(tmp, idx);
    // problem 字符串前缀 = "<name>:<line>:" —— 前缀限定避免 "aaa" 子串误吞 cli-aaa 的引用
    assert.ok(!problems.some((p) => p.startsWith("aaa:")), `model valid refs flagged: ${problems}`);
    assert.ok(
      problems.some((p) => p.startsWith("bbb:") && p.includes("anchor mismatch")),
      `cross-skill anchor-name mismatch not caught: ${problems}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// --- real scan: the osuperpowers skills (semantic mode) must stay clean ---
test("scan osuperpowers skills (semantic) is clean", () => {
  assert.ok(existsSync(ENGINE_SKILLS), `missing skills dir: ${ENGINE_SKILLS}`);
  const idx = buildIndexSemantic(ENGINE_SKILLS);
  const problems = scanSemantic(ENGINE_SKILLS, idx);
  assert.deepEqual(problems, [], problems.join("\n"));
});
