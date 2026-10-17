// packages/kairos/tests/skill-surface-consistency.test.ts
// P9 T15 (spec §3.5 ⑭/⑮ · gate domicile §3.6: engine ⇄ consumer cross-surface →
// kairos suite) — the SKILL-prose ⇄ engine-contract consistency gates. These are
// EXTERNAL comparison gates only (D29 black-box boundary held): they read the
// shipped SKILL.md prose and pin its ref strings against the engine's `REFS`, and
// its doc-root/workspace path literals against `ENGINE_RUNTIME` — the SKILL.md
// text itself carries ZERO changes (the gate observes, never injects implementation
// into the shipped prose).
//
//   ⑭ SKILL ref string ↔ REFS — every `/repo:skill` + `pi：/skill:bare` reference
//      a SKILL authoring surface names must exist in the engine's `REFS` table with
//      the exact per-host spelling (a ref the SKILL names but the engine cannot
//      resolve, or a host-form drift, fails here).
//   ⑮ SKILL path literal ↔ ENGINE_RUNTIME — the `docs/kairos/…` and `.kairos/cdd`
//      literals a SKILL names must match the engine's declared doc roots / workspace
//      segment (a renamed root fails here, never silently drifting).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { REFS } from "../../cdd-engine/src-next/face/host.ts";
import { ENGINE_RUNTIME } from "../../cdd-engine/src-next/infra/runtime.ts";

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

test("⑮ every SKILL doc-root / workspace literal matches ENGINE_RUNTIME", () => {
  // The declared engine path facts: the doc roots + the workspace segment. Every
  // `docs/kairos/...` or `.kairos/cdd` literal a SKILL names must name one of these.
  const declared = [
    ...Object.values(ENGINE_RUNTIME.docRoots),
    ENGINE_RUNTIME.handoffNamespace.workspaceRoot,
  ];
  for (const file of skillFiles()) {
    const text = readFileSync(file, "utf8");
    // The doc-root namespace (the common parent — `docs/kairos`) + the workspace
    // segment are the two literal families the SKILL prose may name.
    const docRootNamespace = path.dirname(ENGINE_RUNTIME.docRoots.specs);
    for (const match of text.matchAll(
      /(?:docs\/kairos\/[A-Za-z0-9_*{}/-]*|\.kairos\/[A-Za-z0-9_*{}/-]*)/g,
    )) {
      const literal = match[0].replace(/\/$/, "");
      const matchesDeclared = declared.some(
        (d) => literal === d || literal.startsWith(`${d}/`) || literal === docRootNamespace,
      );
      expect(
        matchesDeclared,
        `${path.relative(SKILLS_DIR, file)} names the path literal ${literal}, which no ENGINE_RUNTIME doc root / workspace segment covers`,
      ).toBe(true);
    }
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
