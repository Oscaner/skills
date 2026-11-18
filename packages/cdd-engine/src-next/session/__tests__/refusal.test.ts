// packages/cdd-engine/src-next/session/__tests__/refusal.test.ts
// P40 T2 — the tree-level refusal record (design spec §2.1 · §2.2). The record is the
// tree's fact, not a round's: one file beside `in-flight.json`, one atomic overwrite,
// one tri-state read. The suite pins the seven properties the class owes its three
// readers (the board, the command face, the release point's clearance):
//
//   · the write/read round trip — the eight cells come back verbatim, named through the
//     artifact matrix rather than a second literal;
//   · a refusal in a tree whose `.gitignore` never named `.kairos` still leaves the tree
//     CLEAN (the keep-out marker is published before the bytes land — the direct
//     regression of a refusal dirtying its own tree);
//   · the write OVERWRITES, never appends: one tree holds at most one refusal fact;
//   · a malformed record reads `corrupt` with a reason and never throws;
//   · `clear()` is idempotent;
//   · the two read faces are not one: `read()` answers "is this refusal mine" (a record
//     another phase workspace wrote reads `absent`), `readRaw()` answers "what stands on
//     this tree" — pair-asserted on ONE record so the split cannot collapse;
//   · the `station` cell carries the whole structure-leg row set: a record written with
//     any of the nine station words reads back with that word — the record's own gate on
//     the four-value mistake (a `RowStation`-typed cell could not hold `tree-clean`).
//
// Zero module-level bare functions — every helper is an arrow const.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkspaceRoot } from "../../infra/workspace.ts";
import type { PreFlightGateName } from "../preflight.ts";
import { PreFlightRefusal, type RefusalFacts } from "../refusal.ts";

/** The structure leg's nine station words — the record's `station` cell carries the ROW
 *  set, never the four values the judgment produces. */
const STATIONS: readonly PreFlightGateName[] = [
  "tree-clean",
  "in-flight",
  "graph",
  "plan-ledger",
  "doc-contract",
  "no-host",
  "carrier",
  "dispatch-input",
  "artifact",
];

/** One complete refusal fact — the eight cells, with a case's own overrides. */
const factsOf = (over: Partial<RefusalFacts> = {}): RefusalFacts => ({
  at: "2026-11-18T00:00:00.000Z",
  slug: "p40-slug",
  op: "review",
  type: "wave",
  cycle: 1,
  attempt: 1,
  station: "tree-clean",
  detail: "the working tree is dirty",
  ...over,
});

/** A hermetic tree — a temp repo root and the workspace root that owns the record. */
const treeOf = (): { repo: string; root: WorkspaceRoot; cleanup: () => void } => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "refusal-")));
  return {
    repo,
    root: new WorkspaceRoot(repo, ".kairos/cdd"),
    cleanup: () => rmSync(repo, { recursive: true, force: true }),
  };
};

/** Turn the fixture into a clean git repository with one commit. */
const gitInit = (repo: string): void => {
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "refusal@test"],
    ["config", "user.name", "refusal-test"],
    ["add", "-A"],
    ["commit", "-q", "-m", "seed"],
  ]) {
    spawnSync("git", args, { cwd: repo });
  }
};

/** The tree's own judgment — `git status --porcelain`, no engine-side exclusion. */
const dirtyEntriesOf = (repo: string): readonly string[] =>
  spawnSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" })
    .stdout.split("\n")
    .filter((line) => line !== "");

describe("PreFlightRefusal — one record, written and read back", () => {
  it("round-trips the eight cells through the matrix-named file", async () => {
    const { root, cleanup } = treeOf();
    try {
      const refusal = new PreFlightRefusal(root, "p40-slug");
      expect(path.basename(refusal.path())).toBe(PreFlightRefusal.FILE);
      expect(refusal.read()).toEqual({ kind: "absent" });
      const facts = factsOf();
      await refusal.write(facts);
      expect(existsSync(refusal.path())).toBe(true);
      expect(refusal.read()).toEqual({ kind: "standing", facts });
      expect(refusal.readRaw()).toEqual({ kind: "standing", facts });
    } finally {
      cleanup();
    }
  });

  it("leaves a tree with no `.kairos` entry in its own .gitignore CLEAN", async () => {
    const { repo, root, cleanup } = treeOf();
    try {
      writeFileSync(path.join(repo, "seed.txt"), "seed\n", "utf8");
      gitInit(repo);
      expect(dirtyEntriesOf(repo)).toEqual([]);
      // The fixture's `.gitignore` never names `.kairos`: the keep-out marker the write
      // publishes is the only thing standing between one refusal and a dirtied tree.
      await new PreFlightRefusal(root, "p40-slug").write(factsOf());
      expect(readFileSync(path.join(repo, ".kairos", ".gitignore"), "utf8")).toBe("*\n");
      expect(dirtyEntriesOf(repo)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("overwrites the standing record instead of appending a second one", async () => {
    const { root, cleanup } = treeOf();
    try {
      const refusal = new PreFlightRefusal(root, "p40-slug");
      await refusal.write(factsOf({ station: "tree-clean" }));
      const second = factsOf({ station: "artifact", cycle: 2, detail: "rulings-identity · x" });
      await refusal.write(second);
      expect(refusal.read()).toEqual({ kind: "standing", facts: second });
      // One JSON document on disk, never a growing array of facts.
      const bytes = readFileSync(refusal.path(), "utf8");
      expect(JSON.parse(bytes)).toEqual(second);
      expect(bytes.endsWith("\n")).toBe(true);
      expect(bytes.endsWith("\n\n")).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("answers corrupt — never absent, never a throw — for an unparseable or shapeless record", async () => {
    const { root, cleanup } = treeOf();
    try {
      const refusal = new PreFlightRefusal(root, "p40-slug");
      await refusal.write(factsOf());
      writeFileSync(refusal.path(), "{ not json\n", "utf8");
      const broken = refusal.read();
      expect(broken.kind).toBe("corrupt");
      expect(broken.kind === "corrupt" ? broken.reason : "").not.toBe("");
      // Parseable JSON that is not a refusal record is the same shape of damage.
      writeFileSync(refusal.path(), `${JSON.stringify({ slug: "p40-slug" }, null, 2)}\n`, "utf8");
      expect(refusal.read().kind).toBe("corrupt");
      expect(refusal.readRaw().kind).toBe("corrupt");
    } finally {
      cleanup();
    }
  });

  it("clears idempotently — an absent record is not an error", async () => {
    const { root, cleanup } = treeOf();
    try {
      const refusal = new PreFlightRefusal(root, "p40-slug");
      await refusal.write(factsOf());
      refusal.clear();
      expect(refusal.read()).toEqual({ kind: "absent" });
      refusal.clear();
      expect(refusal.read()).toEqual({ kind: "absent" });
      expect(existsSync(refusal.path())).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("answers corrupt for a right-shaped record whose closed-set word is illegal", async () => {
    const { root, cleanup } = treeOf();
    try {
      const refusal = new PreFlightRefusal(root, "p40-slug");
      // Publish the workspace first — the hand-edited record below replaces the writer's
      // own output, so the class's `ensure()` leg is not the case's subject.
      await refusal.write(factsOf());
      // Every cell is of the declared primitive kind; only the WORD is outside the set
      // its table declares. The read face judges the vocabulary at the same boundary the
      // shape is judged (spec §4.2), so the damage is never handed on as a legal fact.
      const illegal = [
        { over: { station: "tree-claen" }, names: "`station`" },
        { over: { op: "branch-review" }, names: "`op`" },
        { over: { type: "task" }, names: "`type`" },
      ];
      for (const { over, names } of illegal) {
        writeFileSync(
          refusal.path(),
          `${JSON.stringify({ ...factsOf(), ...over }, null, 2)}\n`,
          "utf8",
        );
        const read = refusal.readRaw();
        expect(read.kind).toBe("corrupt");
        expect(read.kind === "corrupt" ? read.reason : "").toContain(names);
        expect(refusal.read().kind).toBe("corrupt");
      }
    } finally {
      cleanup();
    }
  });

  it("pairs the two read faces: another workspace's record is absent to `read`, standing to `readRaw`", async () => {
    const { root, cleanup } = treeOf();
    try {
      const facts = factsOf({ slug: "other", station: "in-flight" });
      await new PreFlightRefusal(root, "other").write(facts);
      // "Is this refusal mine" — the board and the command face's question.
      expect(new PreFlightRefusal(root, "p40-slug").read()).toEqual({ kind: "absent" });
      // "What stands on this tree" — the release point's clearance, which may not be
      // filtered by a slug (the fact it invalidates is the tree's occupancy).
      expect(new PreFlightRefusal(root, "p40-slug").readRaw()).toEqual({
        kind: "standing",
        facts,
      });
      // The writer's own read still stands: the pair is symmetric, not one-sided.
      expect(new PreFlightRefusal(root, "other").read()).toEqual({ kind: "standing", facts });
    } finally {
      cleanup();
    }
  });

  it("holds the whole nine-word station set — every word reads back verbatim", async () => {
    const { root, cleanup } = treeOf();
    try {
      const refusal = new PreFlightRefusal(root, "p40-slug");
      for (const station of STATIONS) {
        // The fixture's `detail` is neutral on purpose: a record's `detail` never starts
        // with its station word (the writer strips it), so an example that did would
        // teach the shape spec §2.1 forbids.
        const facts = factsOf({ station, detail: "a one-line reason" });
        await refusal.write(facts);
        expect(refusal.read()).toEqual({ kind: "standing", facts });
      }
    } finally {
      cleanup();
    }
  });
});
