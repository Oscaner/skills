// packages/kairos/tests/recovery-wording.test.ts — the recovery-discipline wording gate
//
// The consumer face's interruption-recovery discipline is THREE canonical sentences,
// one byte string shared by the engine word face (`face/words.ts#inFlight.recovery`)
// and the shipped kairos skills. This gate asserts the consumer surface:
//
//   ① the ABSENCE side — `pgrep` · `git stash` · `checkout --` never enter a
//      SKILL.md. `stash` manufactures a second truth of the working tree and
//      `checkout --` has already destroyed a vertical slice of implementation;
//      the negative pin is the invariant, so it is green before the wording lands.
//   ② the PRESENCE side — at least one SKILL.md quotes the three canonical
//      sentences verbatim — pinned against the ENGINE word face, never re-typed
//      here, so a reword on either plane breaks this gate instead of drifting.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { CAPSULE_WORDS } from "../../cdd-engine/src-next/face/words.ts";

const SKILLS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../skills");

/** Every shipped SKILL.md path, sorted — the closed six-skill consumer surface. */
const skillFiles = (): string[] =>
  readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_ROOT, entry.name, "SKILL.md"))
    .filter((file) => {
      try {
        return readFileSync(file).length > 0;
      } catch {
        return false;
      }
    })
    .sort();

/** One banned recovery shortcut — the pattern that matches it and why it stays out. */
interface RecoveryHookBan {
  readonly pattern: RegExp;
  readonly reason: string;
}

/** The recovery shortcuts banned from the shipped prose. */
const RECOVERY_HOOK_BANS: readonly RecoveryHookBan[] = [
  { pattern: /\bpgrep\b/, reason: "pgrep — process hunting is not a recovery step" },
  {
    pattern: /\bgit stash\b/,
    reason: "git stash — a stash is a second truth of the working tree",
  },
  {
    pattern: /checkout --/,
    reason: "checkout -- — discards changes wholesale and has destroyed real work",
  },
];

test("① no SKILL.md carries pgrep / git stash / checkout --", () => {
  for (const file of skillFiles()) {
    const text = readFileSync(file, "utf8");
    for (const { pattern, reason } of RECOVERY_HOOK_BANS) {
      expect(pattern.test(text), `${path.relative(SKILLS_ROOT, file)} carries ${reason}`).toBe(
        false,
      );
    }
  }
});

test("② a SKILL.md quotes the three canonical recovery sentences verbatim", () => {
  const sentences = CAPSULE_WORDS.inFlight.recovery;
  const carriers = skillFiles().filter((file) => {
    const text = readFileSync(file, "utf8");
    return sentences.every((sentence) => text.includes(sentence));
  });
  expect(
    carriers.map((file) => path.relative(SKILLS_ROOT, file)),
    "no shipped SKILL.md quotes the three canonical recovery sentences from the engine word face",
  ).not.toHaveLength(0);
});
