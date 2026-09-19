#!/usr/bin/env node
// scripts/validate/plan-spec-anchors.ts — Task 13 (P6): plan/spec anchor
// terminal-state validation (spec E2⑥/F1), folded into the block-12 run.
//
// The T17/T18-review anchor-drift class (drifted `**Spec:**` / Parent program
// pointers and dead file-path anchors) is made mechanical here: every path /
// version anchor referenced in spec/plan docs is validated against the real
// tree. Three anchor classes:
//
//   A `**Spec:**` links (plan files) — the target resolves at the repo-root
//     form `docs/osuperpowers/specs/<file>` (the P2 Step-4 grep convention)
//     with a file-relative fallback; the link label must equal the resolved
//     basename (label drift — pointing at one design while claiming another —
//     is a review-observed anchor bug).
//   B `**Parent program**` links (spec + plan files) — the target resolves
//     (file-relative primary, repo-root fallback) to an existing
//     `*-overall.md`, and every `vX.Y` version token on the line must belong to
//     that overall's version lineage (its current `**Version:**` header ∪ the
//     `## Change history` version cells). Lineage membership — not
//     current-equality — is the invariant: frozen historical docs legitimately
//     pin the version in force at authoring time (31 such docs measured),
//     while fabricated / misplaced / future version tokens (the drift class)
//     fail.
//   C general file-path anchors (all spec/plan docs) — relative links resolve
//     at file-relative and repo-root bases. Non-anchor targets are skipped:
//     placeholder / template / regex tokens, scheme + local-anchor links,
//     images, directory refs, fenced-code positions. Historical deleted /
//     relocated surfaces (`_docs/`, the pre-P2 `docs/superpowers/` root,
//     `controller-handoff.md`) and docs whose basename survives in the
//     governed spec/plan/skills-doc index are exempt — the residue.ts
//     doctrine: frozen spec/plan docs record the deletions, the deletion
//     remains do not regress into mechanism positions.
//
// The block count stays 12 — these checks fold into the existing
// "12. overall consistency" step run (overall-consistency.ts) instead of
// adding a 13th step (ci-validate.test.mjs pins steps.length === 12).

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

import { runIfMain } from "./runner.ts";
import { DOC_SPECS_SEGMENTS, DOC_PLANS_SEGMENTS } from "../lib/doc-root.ts";

const SPECS_DIR = path.join(process.cwd(), ...DOC_SPECS_SEGMENTS);
const PLANS_DIR = path.join(process.cwd(), ...DOC_PLANS_SEGMENTS);

const SPEC_MARK = "**Spec:**";
const PARENT_MARK = "**Parent program**";
const LINK_RE = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
const VERSION_TOKEN_RE = /v\d+\.\d+/g;
const VERSION_HEADER_RE = /^\s*-?\s*\*\*Version\*\*:\s*(v\d+\.\d+)/m;
const HISTORY_VERSION_CELL_RE = /^\s*\|\s*(v\d+\.\d+)\s*\|/;

export interface AnchorHit {
  kind:
    | "spec-unresolved" // Class A — **Spec:** target resolves to no existing file
    | "spec-label" //   Class A — link label != resolved basename
    | "parent-unresolved" // Class B — Parent program target resolves to no file
    | "parent-notoverall" //  Class B — resolved target is not a `*-overall.md`
    | "parent-version" //    Class B — a vX.Y token on the line ∉ target lineage
    | "path-unresolved"; //  Class C — file-path anchor resolves at neither base
  file: string; //      absolute path of the doc containing the anchor
  line: number; //      1-based line number of the anchor
  target: string; //    the raw markdown link target
  detail?: string; //   contextual message (label mismatch / missing version …)
}

// Non-anchor targets: scheme / mailto / local-anchor links, `url`-style
// placeholders, `<…>` / `…` / `?=` templates and regex / glob fragments
// (`[…]`, `*`, `|`, `{…}`, `(…)`), whitespace and inline-code backticks, and
// absolute-root paths. Everything here is prose or template, not a tree path.
export function isPlaceholderOrTemplateTarget(t: string): boolean {
  if (!t) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^mailto:/i.test(t)) return true;
  if (t.startsWith("#") || t.startsWith("/")) return true;
  if (t === "." || t === ".." || t.endsWith("/")) return true; // cwd / parent / dir refs
  if (/^url$/i.test(t)) return true;
  if (/[\s<>…?|*{}\[\]()`"'（）]/.test(t)) return true;
  return false;
}

// Deleted / relocated surfaces that frozen historical spec/plan docs cite as
// records of the deletion, not as live paths (the residue.ts doctrine —
// residue guards the mechanism positions, docs may narrate the deletes).
export function isLegacyRef(target: string): boolean {
  return (
    target.startsWith("_docs/") ||
    target.includes("/_docs/") ||
    target.startsWith("docs/superpowers/") ||
    target.includes("/docs/superpowers/") ||
    path.basename(target) === "controller-handoff.md"
  );
}

// Bounded governed-basename index — every `.md` in the current specs/plans dirs
// plus the one-deep relocated-doc surface under packages/osuperpowers/skills/*/
// docs (pre-P2 session docs e.g. base-branch.md / add-phase-protocol.md). Two
// readdirSync levels, never a full-tree find.
export function makeBasenameIndex(specsRoot: string, plansRoot: string): Set<string> {
  const set = new Set<string>();
  for (const dir of [specsRoot, plansRoot]) {
    if (!existsSync(dir)) continue;
    for (const n of readdirSync(dir)) if (n.endsWith(".md")) set.add(n);
  }
  const skillsRoot = path.join(process.cwd(), "packages", "osuperpowers", "skills");
  if (existsSync(skillsRoot)) {
    for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const docs = path.join(skillsRoot, entry.name, "docs");
      if (!existsSync(docs)) continue;
      for (const n of readdirSync(docs)) if (n.endsWith(".md")) set.add(n);
    }
  }
  return set;
}

export function isRescuedByBasename(target: string, index: Set<string>): boolean {
  return index.has(path.basename(target));
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// Resolve a link target against one base; a `#fragment` suffix is stripped so
// `doc.md#section` anchors still resolve against the file.
function resolveFromBase(root: string, target: string): string | null {
  const abs = path.join(root, target.split("#")[0]);
  return isFile(abs) ? abs : null;
}

// Every markdown link (label, target) pair on a line; images (`![…]`) excluded.
function linksOnLine(line: string): Array<{ label: string; target: string }> {
  const out: Array<{ label: string; target: string }> = [];
  for (const m of line.matchAll(LINK_RE)) out.push({ label: m[1], target: m[2] });
  return out;
}

// Version lineage of a target overall doc: current `**Version:**` header ∪
// change-history version cells (`| vX.Y |`). The set is read from the file
// itself — the target overall is the source of truth for its own versions.
export function overallTokenVersions(filePath: string): string[] {
  const raw = readFileSync(filePath, "utf8");
  const versions = new Set<string>();
  const cur = raw.match(VERSION_HEADER_RE);
  if (cur) versions.add(cur[1]);
  for (const line of raw.split("\n")) {
    const cell = line.match(HISTORY_VERSION_CELL_RE);
    if (cell) versions.add(cell[1]);
  }
  return [...versions];
}

function collectSpecLinkHits(planFiles: string[], repoRoot: string): AnchorHit[] {
  const hits: AnchorHit[] = [];
  for (const file of planFiles) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!line.includes(SPEC_MARK)) return;
      for (const { label, target } of linksOnLine(line)) {
        if (isPlaceholderOrTemplateTarget(target)) continue;
        const resolved = resolveFromBase(repoRoot, target) ?? resolveFromBase(path.dirname(file), target);
        if (!resolved) {
          hits.push({ kind: "spec-unresolved", file, line: i + 1, target });
          continue;
        }
        if (label.trim() !== path.basename(resolved)) {
          hits.push({
            kind: "spec-label",
            file,
            line: i + 1,
            target,
            detail: `${label.trim()} != ${path.basename(resolved)}`,
          });
        }
      }
    });
  }
  return hits;
}

function collectParentAnchorHits(docFiles: string[], repoRoot: string): AnchorHit[] {
  const hits: AnchorHit[] = [];
  const lineageCache = new Map<string, Set<string>>();
  for (const file of docFiles) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!line.includes(PARENT_MARK)) return;
      const links = linksOnLine(line);
      if (links.length === 0) return;
      const { target } = links[0];
      if (isPlaceholderOrTemplateTarget(target)) return;
      const resolved = resolveFromBase(path.dirname(file), target) ?? resolveFromBase(repoRoot, target);
      if (!resolved) {
        hits.push({ kind: "parent-unresolved", file, line: i + 1, target });
        return;
      }
      if (!path.basename(resolved).endsWith("-overall.md")) {
        hits.push({ kind: "parent-notoverall", file, line: i + 1, target, detail: path.basename(resolved) });
        return;
      }
      let lineage = lineageCache.get(resolved);
      if (!lineage) {
        lineage = new Set(overallTokenVersions(resolved));
        lineageCache.set(resolved, lineage);
      }
      for (const tok of line.matchAll(VERSION_TOKEN_RE)) {
        if (!lineage.has(tok[0])) {
          hits.push({
            kind: "parent-version",
            file,
            line: i + 1,
            target,
            detail: `${tok[0]} ∉ {${[...lineage].join(", ")}}`,
          });
        }
      }
    });
  }
  return hits;
}

function collectFilePathAnchorHits(docFiles: string[], repoRoot: string, index: Set<string>): AnchorHit[] {
  const hits: AnchorHit[] = [];
  for (const file of docFiles) {
    const lines = readFileSync(file, "utf8").split("\n");
    let inFence = false;
    lines.forEach((line, i) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;
      if (line.includes(SPEC_MARK) || line.includes(PARENT_MARK)) return; // owned by Class A/B
      for (const { target } of linksOnLine(line)) {
        if (isPlaceholderOrTemplateTarget(target)) continue;
        if (isLegacyRef(target)) continue;
        const resolved = resolveFromBase(path.dirname(file), target) ?? resolveFromBase(repoRoot, target);
        if (resolved) continue;
        if (isRescuedByBasename(target, index)) continue;
        hits.push({ kind: "path-unresolved", file, line: i + 1, target });
      }
    });
  }
  return hits;
}

function mdFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".md")).map((n) => path.join(dir, n));
}

// The full anchored surface: Spec links (plans) + Parent program + file paths
// (specs + plans). Roots are injectable for fixtures; defaults target the real
// docs tree (repo-root-relative anchors then resolve against process.cwd()).
export function collectPlanSpecAnchorHits(
  specsRoot: string = SPECS_DIR,
  plansRoot: string = PLANS_DIR,
  repoRoot: string = process.cwd(),
): AnchorHit[] {
  const specFiles = mdFiles(specsRoot);
  const planFiles = mdFiles(plansRoot);
  const docFiles = [...specFiles, ...planFiles];
  const index = makeBasenameIndex(specsRoot, plansRoot);
  return [
    ...collectSpecLinkHits(planFiles, repoRoot),
    ...collectParentAnchorHits(docFiles, repoRoot),
    ...collectFilePathAnchorHits(docFiles, repoRoot, index),
  ];
}

// Terminal-state gate: any anchor failing against the real tree throws (the
// block-runner treats a throw as FAIL). Wired into block 12's run in
// overall-consistency.ts — it never appears as its own step (count stays 12).
export function checkPlanSpecAnchors(
  specsRoot: string = SPECS_DIR,
  plansRoot: string = PLANS_DIR,
  repoRoot: string = process.cwd(),
): number {
  const hits = collectPlanSpecAnchorHits(specsRoot, plansRoot, repoRoot);
  if (hits.length > 0) {
    const rows = hits
      .slice(0, 8)
      .map((h) => `  [${h.kind}] ${h.file}:${h.line} ${h.target}${h.detail ? ` (${h.detail})` : ""}`)
      .join("\n");
    throw new Error(`PLAN/SPEC ANCHOR DRIFT MEASURED — ${hits.length} anchor(s) against real tree:\n${rows}`);
  }
  console.log("OK — plan/spec anchors zero drift (Spec: links · Parent program · file paths)");
  return 0;
}

export const steps = [{ name: "plan/spec anchors (folded into block 12)", run: checkPlanSpecAnchors }];

runIfMain(import.meta.url, steps);