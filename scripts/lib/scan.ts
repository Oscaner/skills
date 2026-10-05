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
// The face also carries the shared escapeRegExp literal-escaper AND the shared isDataRow data-row
// mask (the G2 data-derived allowance predicate): guard regexes built from data rows come from
// ONE escaper and the data-source data-value judgment from ONE face instead of per-file copies.

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

/** The T5 tree-migration spec-verbatim pin file — carries the ORIGINAL acceptance/constraints text
 *  of the migrated six-section design specs (frozen spec history, the same class as CHANGELOG.md,
 *  embedded as test pin data under the scanned tree). The old-vocabulary occurrences there are
 *  DATA, never a code/test regression — but the release is LINE-scoped to the pin map's data region
 *  (isSpecVerbatimPinLine, the same data-row line-scope semantics as isDataRow), so a banned-token
 *  occurrence elsewhere in the file stays a real regression while the guard's live-face ban stays
 *  total everywhere else. */
export const SPEC_VERBATIM_PIN_FILE =
  "packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts";

// The pin map's object-literal span, computed lazily once per process: the SPEC_VERBATIM const
// declaration line through the first `};` line after it. Only hit lines inside this span are pin
// data. Deliberately structural (no brace counting — the pinned strings legitimately contain `{`/
// `}` — so the end is located by the closing `};` line, which the literal's per-entry `},` lines
// never produce).
let specVerbatimDataEnd: { start: number; end: number } | null | undefined;

function specVerbatimPinSpan(): { start: number; end: number } | null {
  if (specVerbatimDataEnd !== undefined) return specVerbatimDataEnd;
  specVerbatimDataEnd = null;
  const abs = path.join(ROOT, SPEC_VERBATIM_PIN_FILE);
  if (!existsSync(abs)) return null;
  const lines = readFileSync(abs, "utf8").split("\n");
  const decl = lines.findIndex((l) => /^\s*const SPEC_VERBATIM\s*[:=]/.test(l));
  const close = decl < 0 ? -1 : lines.findIndex((l, i) => i > decl && /^\s*}\s*;?\s*$/.test(l));
  if (decl >= 0 && close > decl) specVerbatimDataEnd = { start: decl + 1, end: close + 1 };
  return specVerbatimDataEnd;
}

/** A hit line in the SPEC_VERBATIM pin file releases the guarded vocabulary only when it lies inside
 *  the pin map's data region — so a future banned-token occurrence elsewhere in that file stays a
 *  real regression (the isDataRow line-scope semantics, applied to the frozen-history pin data).
 *  Guards call this per line; file-level collectors aggregate its verdict per file. */
export function isSpecVerbatimPinLine(file: string, lineNo: number): boolean {
  if (file !== SPEC_VERBATIM_PIN_FILE) return false;
  const span = specVerbatimPinSpan();
  return span !== null && lineNo >= span.start && lineNo <= span.end;
}

/** The T6 tree-migration plan-migration pin fixture — the acceptance (per task) + constraints body
 *  + dispatch-group expectations of the 17 migrated Do-form plans, captured verbatim from the
 *  pre-transcription state (frozen plan history, the same data class as SPEC_VERBATIM). Every line
 *  of this JSON fixture is pin data (it is a pure data file, never code), so the whole file
 *  releases the guarded vocabulary — the data-row semantics, file-scoped. */
export const PLAN_MIGRATION_PINS_FILE =
  "packages/cdd-engine/src/documents/doctypes/__tests__/fixtures/plan-migration-pins.json";

/** A pin-data file verdict — the plan-migration pins fixture (whole-file data release). Guards call
 *  this per line / per collector alongside isSpecVerbatimPinLine. */
export function isPlanPinDataFile(file: string): boolean {
  return file === PLAN_MIGRATION_PINS_FILE;
}

/** The pin-data release predicate — a scan hit inside T5/T6 tree-migration pin data is DATA, never a
 *  code/test regression: the line-scoped spec-verbatim pin map (isSpecVerbatimPinLine) or the
 *  file-scoped plan-migration pins fixture (isPlanPinDataFile). ONE release policy, single-pointed so
 *  no guard site copies the disjunction; guards call it per line / per collector alongside isDataRow. */
export function isScanPinExempt(file: string, lineNo: number): boolean {
  return isSpecVerbatimPinLine(file, lineNo) || isPlanPinDataFile(file);
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

// JSON `"..."` strings and scalar literals (numbers / true / false / null) are data tokens, not
// structure: stripping them alongside strings keeps an adjacent scalar field (e.g. `"port": 9000`)
// on the allowance line from defeating the structural-purity mask.
const DATA_TOKEN_RE = /"[^"]*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;

/**
 * A line in a data-source file is a data row when (a) stripping every quoted string and scalar
 * literal leaves only JSON structure (a data fragment, never prose/code/comment) and (b) each
 * token occurrence sits in a data-value position — preceded by `:` / `[` / `,` AND not followed
 * by `:` (a mapping value or an array element, never a key). This shared data-row mask is the G2
 * allowance semantic the lexicon residue check applies; the stale-lexicon `--mode` lane rides the
 * same predicate so mechanism scans allow a hit inside a lexicon-registered data source's data
 * value (a harness CLI flag like `-p --mode text`) without a hand-written exemption list. A hit
 * anywhere else on a live face fails.
 */
export function isDataRow(
  dataSources: string[],
  rel: string,
  text: string,
  tokenQuoted: string,
): boolean {
  if (!dataSources.includes(path.basename(rel))) return false;
  if (!/^[\s{}:[\],]*$/.test(text.replace(DATA_TOKEN_RE, ""))) return false;
  let idx = text.indexOf(tokenQuoted);
  while (idx !== -1) {
    let k = idx - 1;
    while (k >= 0 && /\s/.test(text[k])) k--;
    if (!":[,".includes(k >= 0 ? text[k] : "")) return false;
    // Key-ness is decided by what follows the token: a mapping key is always followed by `:`
    // (after whitespace), a data value never is — a `,`-preceded non-first key must fail.
    let j = idx + tokenQuoted.length;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (j < text.length && text[j] === ":") return false;
    idx = text.indexOf(tokenQuoted, idx + tokenQuoted.length);
  }
  return true;
}
