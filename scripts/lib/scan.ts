// scripts/lib/scan.ts — the guard's file-face scan helpers. The word-face audit
// scans whole target dirs (constraint: never an unbounded tree walk over a large tree —
// targets are explicit repo-relative faces like packages/cdd-engine/src-next) with a
// line-level token scan and a data-row release mask (a banned token quoted as a data
// value inside its own declaring file is the release form — the word table's rows).

import type { Dirent } from "node:fs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** One scan hit — the file + 1-indexed line. */
export interface ScanHit {
  file: string;
  line: number;
  text: string;
}

/** Walk a repo-relative target (file or dir) collecting file paths; the walk is
 *  bounded by the explicit target list — never an unbounded full-tree scan. */
export function walkTarget(target: string, root: string): string[] {
  const abs = path.join(root, target);
  const out: string[] = [];
  const visit = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(p);
      else if (entry.isFile()) out.push(p);
    }
  };
  try {
    if (statSync(abs).isFile()) return [abs];
  } catch {
    return [];
  }
  visit(abs);
  return out;
}

/** Line-level token scan over target files — every line carrying the token, with the
 *  release-file mask: a token inside a quoted string BUILDS A HIT everywhere except
 *  the ban vocabulary's own data homes (the word-table file + the host contract's
 *  cli data values), where the quoted row IS the release form. A live face must
 *  never become a carrier of the vocabulary it guards. */
export function scanToken(
  targets: readonly string[],
  token: string,
  root: string,
  opts: { releaseFiles?: readonly string[]; excludePaths?: readonly string[] } = {},
): ScanHit[] {
  const hits: ScanHit[] = [];
  const releaseFiles = opts.releaseFiles ?? [];
  const excludePaths = opts.excludePaths ?? [];
  for (const target of targets) {
    for (const file of walkTarget(target, root)) {
      const relative = path.relative(root, file);
      // Exclusions are a per-file fact — skip the whole file, never abort the line
      // loop mid-file (a `break` here would silently drop the file's remaining lines).
      if (excludePaths.some((prefix) => relative.startsWith(`${prefix}/`))) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i]!;
        if (!text.includes(token)) continue;
        if (releaseFiles.includes(relative) && isQuotedDataRow(text, token)) continue;
        hits.push({ file: relative, line: i + 1, text });
      }
    }
  }
  return hits;
}

/** Whether a line carries the token only inside quoted strings (the release-row
 *  form — a data-home line that quotes the value, never restates it bare). */
export function isQuotedDataRow(candidate: string, token: string): boolean {
  const stripped = candidate.replace(/"[^"]*"/g, "");
  return !stripped.includes(token);
}
