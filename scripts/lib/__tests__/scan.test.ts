// scripts/lib/__tests__/scan.test.ts — unit tests for the shared target-scan face
// (scripts/lib/scan.ts): the SPEC_VERBATIM pin-data release is LINE-scoped to the pin map's
// object-literal region — a banned-token occurrence outside the map is a real regression, never
// silently exempted (the same data-row line-scope semantics isDataRow applies).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isSpecVerbatimPinLine, SPEC_VERBATIM_PIN_FILE } from "../scan.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");

// Guarded root-resolver tokens assembled fragment-wise: a guard test asserting "dead vocabulary
// absent" must not carry the dead vocabulary as a literal (the same convention the guard-side token
// constants follow), so this file spells them as fragments only.
const rootResolverTokens = [
  ["root", "FromDoc", "Path"].join(""),
  ["resolve", "Repo", "Root"].join(""),
];

describe("isSpecVerbatimPinLine — the pin-map data-region release is line-scoped", () => {
  const pinLines = readFileSync(path.join(ROOT, SPEC_VERBATIM_PIN_FILE), "utf8").split("\n");
  // The pin map is the SPEC_VERBATIM object literal: it opens at the `const SPEC_VERBATIM`
  // declaration and closes at the first `};` line after it (the per-entry `},` lines never match — a
  // structural end-locator, deliberately not brace counting, since pinned strings contain braces).
  const declIdx = pinLines.findIndex((l) => /^\s*const SPEC_VERBATIM\s*[:=]/.test(l));
  const closeIdx = pinLines.findIndex((l, i) => i > declIdx && /^\s*}\s*;?\s*$/.test(l));

  it("releases pin-data lines carrying the guarded vocabulary", () => {
    expect(declIdx).toBeGreaterThan(0);
    expect(closeIdx).toBeGreaterThan(declIdx);
    // A pinned acceptance row inside the map carries one of the guarded root-resolver tokens.
    const hitToken = rootResolverTokens.find((tok) => pinLines.some((l) => l.includes(tok)));
    const dataLine = hitToken ? pinLines.findIndex((l) => l.includes(hitToken)) : -1;
    expect(hitToken).toBeDefined();
    expect(dataLine).toBeGreaterThan(declIdx);
    expect(dataLine).toBeLessThan(closeIdx);
    expect(isSpecVerbatimPinLine(SPEC_VERBATIM_PIN_FILE, dataLine + 1)).toBe(true);
    // The map's first and last lines are pin data too.
    expect(isSpecVerbatimPinLine(SPEC_VERBATIM_PIN_FILE, declIdx + 2)).toBe(true);
    expect(isSpecVerbatimPinLine(SPEC_VERBATIM_PIN_FILE, closeIdx + 1)).toBe(true);
  });

  it("stays silent outside the map — header and post-map code never release", () => {
    expect(isSpecVerbatimPinLine(SPEC_VERBATIM_PIN_FILE, 1)).toBe(false); // header
    expect(isSpecVerbatimPinLine(SPEC_VERBATIM_PIN_FILE, closeIdx + 2)).toBe(false); // after };
  });

  it("every guarded-vocabulary occurrence in the current pin file is map data — zero outside", () => {
    // The release must never mask a real regression: today's banned-token occurrences all live in
    // the pin map; a future one outside it flips this assertion and is caught instead of exempted.
    pinLines.forEach((line, index) => {
      for (const token of rootResolverTokens) {
        if (line.includes(token)) {
          expect(
            isSpecVerbatimPinLine(SPEC_VERBATIM_PIN_FILE, index + 1),
            `${token} hits line ${index + 1}, outside the pin map`,
          ).toBe(true);
        }
      }
    });
  });

  it("touches no other file", () => {
    expect(isSpecVerbatimPinLine("scripts/lib/scan.ts", declIdx + 2)).toBe(false);
  });
});
