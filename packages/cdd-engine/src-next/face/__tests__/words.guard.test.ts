// packages/cdd-engine/src-next/face/__tests__/words.guard.test.ts
// P5 — the engine-literal half of the word-face audit, colocated after the
// D17 six-前提 归域 (the root guard's checkWords split: the skill-text half
// re-homes to the kairos test plane, the engine-literal half lands HERE — the
// surfaces this tree owns must carry zero of its own retired vocabulary). The
// token set is the exported ban-table data (`guard.ts` GUARD_BAN_WORDS), never a
// hand-written list; the scan release-masks the ban-round's own data homes
// (`face/words.ts` · `face/host.ts` — their quoted rows ARE the release form,
// where the guard-ban vocabulary legitimately lives as declared data).
//
// The stale + gate families are the retired-mechanism tokens the engine's live
// faces must stay clean of; the shape family is the consumer-skill surface's
// concern (the kairos plane) and rides no source-face scan here.
//
// Zero module-level bare functions — the walk/scan helpers are `const` (the P5
// zero-`function`-declaration discipline).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { GUARD_BAN_WORDS } from "../words.ts";

/** The src-next plane root — the engine's own source face (the scan set). */
const FACE_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The ban vocabulary's data homes — the files whose quoted rows are the release
 *  form (a live face never carries the lexeme outside these homes). */
const RELEASE_FILES = new Set(["face/words.ts", "face/host.ts"]);

/** Walk the src-next tree collecting `.ts` files (bounded — the explicit plane root). */
const collectTsFiles = (dir: string, out: string[]): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsFiles(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
};

/** Whether a line carries the token only inside quoted strings (the release-row
 *  form — a data-home line that lists the value, never restates it bare). */
const isQuotedDataRow = (line: string, token: string): boolean =>
  !line.replace(/"[^"]*"/g, "").includes(token);

/** One token's scanned hits over the src-next tree (the relative file + line). */
const scanHits = (token: string): string[] => {
  const files: string[] = [];
  collectTsFiles(FACE_ROOT, files);
  const hits: string[] = [];
  for (const file of files) {
    const relative = path.relative(FACE_ROOT, file);
    const release = RELEASE_FILES.has(relative);
    const lines = readFileSync(file, "utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index]!;
      if (!text.includes(token)) continue;
      if (release && isQuotedDataRow(text, token)) continue;
      hits.push(`${relative}:${index + 1}`);
    }
  }
  return hits;
};

describe("the engine-literal word-face audit — the guard-ban vocabulary on the engine source face", () => {
  it("the src-next face carries zero stale-family ban tokens (release-masked at the data homes)", () => {
    const tokens = GUARD_BAN_WORDS.stale.map((row) => row.token);
    for (const token of tokens) {
      const hits = scanHits(token);
      expect(hits, `the engine source face carries the ban token "${token}"`).toEqual([]);
    }
  });

  it("the src-next face carries zero gate-family ban tokens (release-masked at the data homes)", () => {
    const tokens = GUARD_BAN_WORDS.gate.map((row) => row.token);
    for (const token of tokens) {
      const hits = scanHits(token);
      expect(hits, `the engine source face carries the ban token "${token}"`).toEqual([]);
    }
  });

  it("the release homes do carry their declared rows — the mask is the release form, never a blind skip", () => {
    // The mask must NOT be vacuous: the two data homes hold every stale + gate
    // row as a quoted data value — the release-masked scan stands down only for
    // those exact rows (a non-quoted restatement would build a hit).
    const tokens = [...GUARD_BAN_WORDS.stale, ...GUARD_BAN_WORDS.gate].map((row) => row.token);
    const homes = [...RELEASE_FILES].map((relative) => path.join(FACE_ROOT, relative));
    const all = readFileSync(homes[0]!, "utf8") + readFileSync(homes[1]!, "utf8");
    for (const token of tokens) {
      expect(all.includes(token), `the data home carries its declared row "${token}"`).toBe(true);
    }
  });
});
