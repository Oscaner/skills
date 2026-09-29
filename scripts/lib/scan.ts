// scripts/lib/scan.ts — the shared target-scan machinery (walk + scan) for the validate-side
// guards (P3 T4): extracted from scripts/validate/residue.ts so the ContractLexiconGuard
// (scripts/lib/contract-lexicon.ts) and the residue block consume ONE walk/scan face instead of
// two drifted copies. Semantics are byte-identical to the pre-extraction residue.ts helpers:
// tinyglobby replaces hand-written recursion (`dot: true` scans hidden subdirectories like
// .claude-plugin/); a missing target throws a clear Error (aligned with the G7/G8 "deleted path
// has returned" style — a rename/deletion surfaces as a readable guard failure, never an obscure
// statSync ENOENT); `**/__tests__/` is skipped by default (the guard/test self-exemption doctrine
// — tests asserting "dead vocabulary absent" necessarily carry the guarded words, so mechanism
// scans must not trust test sites); guards that do scan tests opt in explicitly via
// { includeTests: true }, with scope still written as src/... (never the deleted tests/).
//
// The face also carries the shared escapeRegExp literal-escaper: guard regexes built from data
// rows (lexicon / canonical tables) come from ONE escaper in contract-lexicon.ts and residue.ts
// instead of per-file copies.

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "tinyglobby";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

export interface ScanOptions {
  /** Walk into `__tests__` positions too (opt-in; default false — the self-exemption doctrine). */
  includeTests?: boolean;
}

export interface ScanLineHit {
  file: string;
  lineNo: number;
  text: string;
}

/** The file surface of a target set (readable, non-binary files, tests self-exempt by default). */
export function walkTargetFiles(targets: string[], opts: ScanOptions = {}): string[] {
  const out = [];
  for (const t of targets) {
    const abs = path.isAbsolute(t) ? t : path.join(ROOT, t);
    if (!existsSync(abs)) {
      throw new Error(
        `walkTargetFiles: target missing — ${t} (deleted file? adjust target set or this sweep scope)`,
      );
    }
    const paths = statSync(abs).isDirectory()
      ? globSync("**/*", { cwd: abs, absolute: true, dot: true })
      : [abs];
    for (const f of paths) {
      if (readFileSync(f).includes(0)) continue; // binary — grep -rn reports, doesn't content-match
      if (!opts.includeTests && f.includes(`${path.sep}__tests__${path.sep}`)) continue;
      out.push(f);
    }
  }
  return out;
}

/** File-level scan: repo-relative paths of every hit file (binary and test-site disposition per opts). */
export function scanTargets(targets: string[], re: RegExp, opts: ScanOptions = {}): string[] {
  const hits = [];
  for (const f of walkTargetFiles(targets, opts)) {
    if (re.test(readFileSync(f).toString("utf8"))) hits.push(path.relative(ROOT, f));
  }
  return hits;
}

/** Line-level scan: { file, lineNo, text } per hit line (lineNo is 1-indexed). */
export function scanLines(targets: string[], re: RegExp, opts: ScanOptions = {}): ScanLineHit[] {
  const hits = [];
  for (const f of walkTargetFiles(targets, opts)) {
    const lines = readFileSync(f).toString("utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]))
        hits.push({ file: path.relative(ROOT, f), lineNo: i + 1, text: lines[i] });
    }
  }
  return hits;
}

/** File-listing helper (scanLines' file surface): repo-relative paths of every non-binary file. */
export function listTargetFiles(targets: string[]): string[] {
  return walkTargetFiles(targets).map((f) => path.relative(ROOT, f));
}

/** Escape a string literal for safe use inside a RegExp construction. Guard regexes built from
 *  data rows (lexicon word-table entries / canonical category tables) go through this single
 *  escaper so the consumers never carry a hand-copied escape one-liner. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
