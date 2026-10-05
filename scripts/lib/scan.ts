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
 *  DATA, never a code/test regression: every guard that scans test sites releases this file (the
 *  same release semantics as a data-source data row), so a verbatim pin never misreads as a
 *  regression while the guard's live-face ban stays total everywhere else. */
export const SPEC_VERBATIM_PIN_FILE =
  "packages/cdd-engine/src/documents/doctypes/__tests__/tree-migration.test.ts";

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
