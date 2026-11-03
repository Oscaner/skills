// scripts/__tests__/changeset-levels.test.ts — the version-level gate (charter D74):
// the release level tracks the METHODOLOGY contract, not byte-level CLI compatibility.
// While the CDD flow itself is unchanged (design → spec → plan → dev → close, the
// severity-graded convergence, the gate and `next:` faces), even a consumer-visible
// breaking byte change — a flag, a `--type` word, a rendered literal — is a MINOR;
// `major` is reserved for a change to the methodology, which practically never
// happens here. `.changeset/README.md` states the criterion for authors; this file is
// its machine twin, so a `major` cannot slip into a release by accident.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../emit.ts";

/** The release levels a changeset may declare, in the order semver knows them. */
const LEVELS = ["patch", "minor", "major"] as const;

/** One parsed changeset: the file plus every level word its front matter names. */
interface ChangesetRow {
  readonly file: string;
  readonly levels: readonly string[];
}

/** The declaration block is the leading `---` fence; the levels live there. */
const FRONT_MATTER = /^---\n([\s\S]*?)\n---/;

/** The level words a changeset's front matter declares (semver order, never file order). */
const levelsOf = (source: string): readonly string[] => {
  const fence = FRONT_MATTER.exec(source);
  if (fence === null) return [];
  return LEVELS.filter((level) => new RegExp(`:\\s*${level}\\s*$`, "m").test(fence[1]!));
};

/** The repo's `.changeset/*.md` rows with their declared levels (README/config excluded). */
const rows = (root: string = REPO_ROOT): readonly ChangesetRow[] => {
  const dir = path.join(root, ".changeset");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
    .map((file) => ({ file, levels: levelsOf(readFileSync(path.join(dir, file), "utf8")) }));
};

describe("Changeset levels — the release level follows the methodology contract (D74)", () => {
  it("no changeset declares a major", () => {
    const offenders = rows()
      .filter((row) => row.levels.includes("major"))
      .map((row) => row.file);
    expect(
      offenders,
      `major is reserved for a change to the CDD methodology; these declare it: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("every changeset declares at least one level", () => {
    const silent = rows()
      .filter((row) => row.levels.length === 0)
      .map((row) => row.file);
    expect(silent, `a changeset with no level declares no release: ${silent.join(", ")}`).toEqual(
      [],
    );
  });

  it("the reader parses the three levels (the gate can actually go red)", () => {
    expect(levelsOf('---\n"@oscaner-skills/x": major\n---\n')).toEqual(["major"]);
    expect(levelsOf('---\n"@oscaner-skills/x": minor\n---\n')).toEqual(["minor"]);
    expect(
      levelsOf('---\n"@oscaner-skills/x": patch\n"@oscaner-skills/y": minor\n---\n'),
      // The reader answers in SEMVER order (patch → minor → major), not file order.
    ).toEqual(["patch", "minor"]);
  });
});
