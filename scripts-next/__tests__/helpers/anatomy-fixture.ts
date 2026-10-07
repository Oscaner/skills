// scripts-next/__tests__/helpers/anatomy-fixture.ts — the anatomy-check test fixture:
// a minimal node-anchored SKILL.md that PASSES guardLibrary.checkAnatomy (all four
// public sections · one mermaid-only digraph · one defined operator node with the
// four-element contract · the Invariants/Failure Modes tables · no Skeleton deltas —
// not a trio carrier). The `unregistered` toggle injects a registry-external heading
// so the strict-allowlist check fires.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** A minimal valid node-anchored SKILL.md — the anatomy check's passing baseline. */
export function intactSkillText(unregistered = false): string {
  const extra = unregistered ? "\n## Bogus narrative\n\nunregistered heading\n\n" : "";
  return [
    "# test-skill",
    "",
    "## Flow Digraph",
    "",
    "```mermaid",
    "start[do-the-thing] --> approved((APPROVED))",
    "```",
    "",
    "## Node Definitions",
    "",
    "### `do-the-thing`",
    "",
    "- **Do**: execute the action",
    "- **Read**: nothing",
    "- **Exit**: to the approved terminal",
    "- **Fail**: throw",
    "",
    "## Invariants",
    "",
    "| IN | the invariant holds |",
    "",
    "## Failure Modes",
    "",
    "| failure | behavior |",
    extra,
    "",
  ].join("\n");
}

/** The fixture home — writes the skill text to a temp dir and cleans it up. */
export class AnatomyFixture {
  readonly dir: string;
  readonly file: string;

  constructor(text: string) {
    this.dir = mkdtempSync(path.join(tmpdir(), "anatomy-fixture-"));
    this.file = path.join(this.dir, "SKILL.md");
    writeFileSync(this.file, text, "utf8");
  }

  /** Clean up the temp dir. */
  cleanup(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** Create the passing fixture (optionally with the unregistered heading). */
export function analyticsSkillFixture(opts: { unregistered?: boolean } = {}): {
  write: () => string;
  cleanup: () => void;
  an: { unregistered: boolean };
} {
  const fixture = new AnatomyFixture(intactSkillText(opts.unregistered ?? false));
  return {
    an: { unregistered: opts.unregistered ?? false },
    write: () => fixture.file,
    cleanup: () => fixture.cleanup(),
  };
}
