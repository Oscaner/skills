// packages/kairos/tests/words.test.ts
// P5 — the kairos-side skill-text word audit, colocated after the D17 six-前提
// 归域 (the root guard's checkWords half that scans the consumer-skill surface
// re-homes here — kairos owns its shipped prose; the engine-literal half lives
// in the engine's colocated suite). The ban vocabulary is the engine's exported
// `GUARD_BAN_WORDS` data (the word table is single-sourced at
// `src-next/face/words.ts` — kairos consumes the export, never a second list);
// every family — stale / gate / shape — must be absent from the six SKILL.md
// products.
//
// Zero module-level bare functions — the scan helper is a `const` arrow (the P5
// zero-`function`-declaration discipline applies to this migrated surface too).

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { GUARD_BAN_WORDS } from "../../cdd-engine/src-next/face/words.ts";

/** The kairos skills root — the six SKILL.md products (the audit's scan set). */
const SKILLS_ROOT = path.join(fileURLToPath(new URL("..", import.meta.url)), "skills");
/** The six SKILL.md absolute paths — every skill dir's SKILL.md. */
const SKILL_FILES = readdirSync(SKILLS_ROOT, { withFileTypes: true })
  .filter((ent) => ent.isDirectory())
  .map((ent) => path.join(SKILLS_ROOT, ent.name, "SKILL.md"));

/** The full guard-ban token set — every family's banned rows, flat (the
 *  single-source scan set the audit walks). */
const BAN_TOKENS = Object.values(GUARD_BAN_WORDS).flatMap((family) =>
  family.map((row) => row.token),
);

test("the six SKILL.md products carry zero guard-ban vocabulary (the ban-table single source)", () => {
  const findings: string[] = [];
  for (const file of SKILL_FILES) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index]!;
      for (const token of BAN_TOKENS) {
        if (text.includes(token)) findings.push(`${path.basename(file)}:${index + 1}: ${token}`);
      }
    }
  }
  assert.deepEqual(
    findings,
    [],
    `the skill texts carry the guard-ban vocabulary:\n${findings.join("\n")}`,
  );
});
