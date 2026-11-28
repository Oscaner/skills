// packages/kairos/tests/skill-surface-consistency.test.ts
// P9 T15 (spec §3.5 ⑭/⑮ · gate domicile §3.6: engine ⇄ consumer cross-surface →
// kairos suite) — the SKILL-prose ⇄ engine-contract consistency gates. These are
// EXTERNAL comparison gates only (D29 black-box boundary held): they read the
// shipped SKILL.md prose and pin its ref strings against the engine's `REFS`, and
// its doc-root/workspace path literals against the engine's declared doc-root segments
// and workspace segment — the SKILL.md
// text itself carries ZERO changes (the gate observes, never injects implementation
// into the shipped prose).
//
//   ⑭ SKILL ref string ↔ REFS — every `/repo:skill` + `pi：/skill:bare` reference
//      a SKILL authoring surface names must exist in the engine's `REFS` table with
//      the exact per-host spelling (a ref the SKILL names but the engine cannot
//      resolve, or a host-form drift, fails here).
//   ⑮ SKILL path literal ↔ the declared segments — the `docs/kairos/…` and `.kairos/cdd`
//      literals a SKILL names must match the engine's declared doc roots / workspace
//      segment (a renamed root fails here, never silently drifting).
//   ⑯ ruling landing sentence — the three orchestrators that dispatch a fix round each
//      carry the landing instruction at their own invariant table tail, and the sentence
//      is ONE sentence: the three land at the same engineered path, so three slightly
//      different instructions would be three different contracts.
//   ⑰ sidecar file-name literal — the landing instruction points at the path the engine
//      prints, never at a file name the orchestrator would have to derive; a literal
//      spelling in shipped prose teaches the second expression we retired.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { DOC_ROOT_SEGMENTS } from "../../cdd-engine/src/env/paths/doc-roots.ts";
import { REFS } from "../../cdd-engine/src/env/process/host.ts";
import { WorkspaceRoot } from "../../cdd-engine/src/env/workspace/workspace.ts";

const SKILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../skills");

/** Every shipped SKILL.md path, sorted (the closed six-skill roster on disk). */
const skillFiles = (): string[] =>
  readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_DIR, entry.name, "SKILL.md"))
    .filter((file) => {
      try {
        readFileSync(file);
        return true;
      } catch {
        return false;
      }
    })
    .sort();

/** The ref rows the engine's REFS table carries, keyed by their per-host slash
 *  spellings — the reverse index the SKILL prose is pinned against (every host
 *  form of a declared ref key maps back to that key). */
const refFormsBySpelling = (): Map<string, string> => {
  const bySpelling = new Map<string, string>();
  for (const [key, forms] of Object.entries(REFS)) {
    for (const form of Object.values(forms)) bySpelling.set(form, key);
  }
  return bySpelling;
};

/** The full-slash ref tokens a SKILL body names (`/namespace:skill`). */
const refTokensOf = (text: string): string[] => {
  const tokens = new Set<string>();
  for (const match of text.matchAll(/\/[A-Za-z0-9_-]+:[A-Za-z0-9_-]+/g)) {
    tokens.add(match[0]);
  }
  return [...tokens].sort();
};

test("⑭ every SKILL ref string resolves to a declared engine REFS entry", () => {
  const bySpelling = refFormsBySpelling();
  for (const file of skillFiles()) {
    const text = readFileSync(file, "utf8");
    for (const token of refTokensOf(text)) {
      expect(
        bySpelling.has(token),
        `${path.relative(SKILLS_DIR, file)} names ${token}, which the engine's REFS table does not declare`,
      ).toBe(true);
    }
  }
});

test("⑭ the `pi：/skill:bare` companion form matches the ref's declared pi spelling", () => {
  const bySpelling = refFormsBySpelling();
  for (const file of skillFiles()) {
    const text = readFileSync(file, "utf8");
    // The prose pairs a slash ref with its pi flat form: `<ref>（pi：/<pi-form>）`.
    for (const match of text.matchAll(
      /(\/[A-Za-z0-9_-]+:[A-Za-z0-9_-]+)（pi：(\/skill:[A-Za-z0-9_-]+)）/g,
    )) {
      const [, primary, piForm] = match;
      const key = bySpelling.get(primary!);
      expect(
        key,
        `${path.relative(SKILLS_DIR, file)} pairs ${primary} with ${piForm}, but the engine declares no ref ${primary}`,
      ).toBeDefined();
      // The pi companion must be the SAME ref's declared pi spelling (never a
      // mismatched pairing: `/superpowers:brainstorming（pi：/skill:writing-plans）`).
      expect(
        REFS[key as keyof typeof REFS]?.pi,
        `${path.relative(SKILLS_DIR, file)} pairs ${primary} with ${piForm}, but that ref's declared pi form differs`,
      ).toBe(piForm);
    }
  }
});

test("⑮ every SKILL doc-root / workspace literal matches the engine's declared segments", () => {
  // The declared engine path facts: the doc roots + the workspace segment. Every
  // `docs/kairos/...` or `.kairos/cdd` literal a SKILL names must name one of these.
  const declared = [...Object.values(DOC_ROOT_SEGMENTS), WorkspaceRoot.DEFAULT_SEGMENT];
  for (const file of skillFiles()) {
    const text = readFileSync(file, "utf8");
    // The doc-root namespace (the common parent — `docs/kairos`) + the workspace
    // segment are the two literal families the SKILL prose may name.
    const docRootNamespace = path.dirname(DOC_ROOT_SEGMENTS.specs);
    for (const match of text.matchAll(
      /(?:docs\/kairos\/[A-Za-z0-9_*{}/-]*|\.kairos\/[A-Za-z0-9_*{}/-]*)/g,
    )) {
      const literal = match[0].replace(/\/$/, "");
      const matchesDeclared = declared.some(
        (d) => literal === d || literal.startsWith(`${d}/`) || literal === docRootNamespace,
      );
      expect(
        matchesDeclared,
        `${path.relative(SKILLS_DIR, file)} names the path literal ${literal}, which no declared doc root / workspace segment covers`,
      ).toBe(true);
    }
  }
});

/** Every `.md` file in one skill's optional `docs/` directory (absent ⇒ no files). */
const docsOf = (docsDir: string): string[] => {
  try {
    return readdirSync(docsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.join(docsDir, entry.name));
  } catch {
    return [];
  }
};

/** Every shipped skill `docs/*.md` companion, sorted (`docs/` is optional per skill). */
const skillDocsFiles = (): string[] => {
  const files: string[] = [];
  for (const dir of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (dir.isDirectory()) files.push(...docsOf(path.join(SKILLS_DIR, dir.name, "docs")));
  }
  return files.sort();
};

/** Every shipped skill prose file — the SKILL.md roster plus its doc companions. */
const skillProseFiles = (): string[] => [...skillFiles(), ...skillDocsFiles()].sort();

/** The invariant row the ruling landing instruction sits at, per skill. The row id is
 *  fixed where the instruction became a contract; it is the table's tail there, so only a
 *  renumbering of that table can lose it. */
const RULING_LANDING_ROWS: Record<string, string> = {
  "cdd-dev": "I6",
  "cdd-plan": "I5",
  "cdd-spec-writer": "I4",
};

/** The `| I<n> | body |` rows of a document, keyed by row id (the invariant table shape). */
const invariantRowsOf = (text: string): Map<string, string> => {
  const rows = new Map<string, string>();
  for (const match of text.matchAll(/^\|\s*(I\d+)\s*\|(.+)\|\s*$/gm)) {
    rows.set(match[1]!, match[2]!.trim());
  }
  return rows;
};

test("⑯ the ruling landing instruction is ONE sentence across the three orchestrators", () => {
  const bodies = new Map<string, string>();
  for (const [skill, row] of Object.entries(RULING_LANDING_ROWS)) {
    const rows = invariantRowsOf(readFileSync(path.join(SKILLS_DIR, skill, "SKILL.md"), "utf8"));
    const body = rows.get(row);
    expect(
      body,
      `${skill}/SKILL.md carries no ${row} invariant row — the ruling landing instruction is missing`,
    ).toBeTruthy();
    bodies.set(skill, body!);
  }
  const [leadSkill, leadBody] = [...bodies.entries()][0]!;
  for (const [skill, body] of bodies) {
    expect(
      body,
      `${skill}/SKILL.md's ${RULING_LANDING_ROWS[skill]} sentence drifted from ${leadSkill}/SKILL.md's — one landing path, one sentence`,
    ).toBe(leadBody);
  }
});

test("⑰ shipped skill prose carries zero sidecar file-name literal", () => {
  // The instruction says WHERE the ruling goes by naming the path the engine prints in
  // `next:` — a file-name literal here would restore the derivation the engine retired.
  for (const file of skillProseFiles()) {
    const text = readFileSync(file, "utf8");
    expect(
      text.includes(".rulings.json"),
      `${path.relative(SKILLS_DIR, file)} spells the sidecar artifact file name — the landing instruction points at the printed path, never at a name to derive`,
    ).toBe(false);
  }
});

test("⑮ the SKILL prose carries zero hard-coded absolute root prefix", () => {
  // The path literals are repoRoot-relative user-facing conventions (spec §2.13);
  // a SKILL must never name an absolute root (`/Users/...`) — the ONE shape is
  // relative. This pins the shipped prose to the relative convention.
  for (const file of skillFiles()) {
    const text = readFileSync(file, "utf8");
    expect(
      /(?:^|[\s`(])\/(?:Users|home|private|tmp|var)\//.test(text),
      `${path.relative(SKILLS_DIR, file)} carries an absolute root prefix — the ONE path shape is repoRoot-relative`,
    ).toBe(false);
  }
});
