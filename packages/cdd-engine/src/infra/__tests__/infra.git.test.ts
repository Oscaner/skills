// packages/cdd-engine/src/infra/__tests__/infra.git.test.ts
// Spec §2.13 git row: status/add/commit/head/log replace the hand-written
// hand-written git subprocess helpers in rules/commit.mjs. Fail-open contracts mirror
// the old helpers (non-repo / git error → null / false).

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitClient } from "../git.ts";

const git = new GitClient();

import { gitCommit, gitInit } from "./helpers.ts";

let repo: string;

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), "infra-git-"));
  gitInit(repo);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("infra/git.ts — gitTopLevel", () => {
  it("temp repo → absolute toplevel path", async () => {
    const top = await git.topLevel(repo);
    expect(String(top)).toMatch(/^\/.+infra-git-/);
  });

  it("non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo-"));
    try {
      expect(await git.topLevel(bare)).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("infra/git.ts — gitRevParseHead", () => {
  it("temp repo → 40-hex sha matching git rev-parse HEAD", async () => {
    const head = await git.revParseHead(repo);
    const actual = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
    expect(head).toBe(actual);
    expect(String(head)).toMatch(/^[0-9a-f]{40}$/);
  });

  it("non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo2-"));
    try {
      expect(await git.revParseHead(bare)).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("infra/git.ts — gitStatusPorcelain", () => {
  it("clean tree → empty string", async () => {
    expect(await git.statusPorcelain(repo)).toBe("");
  });

  it("untracked file → non-empty porcelain", async () => {
    writeFileSync(path.join(repo, "untracked.txt"), "x\n");
    const p = await git.statusPorcelain(repo);
    expect(p).toContain("untracked.txt");
  });

  it("non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo3-"));
    try {
      expect(await git.statusPorcelain(bare)).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("infra/git.ts — gitAdd / gitCommit / gitLog", () => {
  it("stage a file → porcelain shows it staged; commit → clean tree with new head", async () => {
    // persistent identity config so simple-git commit succeeds (helpers gitInit uses -c inline only)
    execFileSync("git", ["-C", repo, "config", "user.name", "t"]);
    execFileSync("git", ["-C", repo, "config", "user.email", "t@t"]);
    writeFileSync(path.join(repo, "added.txt"), "content\n");
    expect(await git.add(repo, ["added.txt"])).toBe(true);
    expect(await git.statusPorcelain(repo)).toContain("added.txt");
    const headBefore = await git.revParseHead(repo);
    const sha = await git.commit(repo, "add added.txt");
    expect(String(sha)).toMatch(/^[0-9a-f]{40}$/);
    const headAfter = await git.revParseHead(repo);
    expect(headAfter).toBe(sha);
    expect(headAfter).not.toBe(headBefore);
    expect(await git.statusPorcelain(repo)).toBe("");
  });

  it("gitCommit in non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo4-"));
    try {
      expect(await git.commit(bare, "nope")).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("gitLog lists commits newest-first with hash+message", async () => {
    execFileSync("git", ["-C", repo, "config", "user.name", "t"]);
    execFileSync("git", ["-C", repo, "config", "user.email", "t@t"]);
    mkdirSync(path.join(repo, "sub"), { recursive: true });
    writeFileSync(path.join(repo, "sub", "a.txt"), "a\n");
    gitCommit(repo, "second commit");
    const entries = await git.log(repo, { maxCount: 2 });
    expect(entries).not.toBeNull();
    const arr = entries!;
    expect(arr).toHaveLength(2);
    expect(arr[0].message).toBe("second commit");
    expect(arr[1].message).toBe("init");
    expect(arr[0].hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("gitLog in non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo5-"));
    try {
      expect(await git.log(bare, {})).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("infra/git.ts — gitCatFileCommitExists", () => {
  it("real HEAD sha → true", async () => {
    const sha = await git.revParseHead(repo);
    expect(sha).not.toBeNull();
    expect(await git.catFileCommitExists(repo, sha!)).toBe(true);
  });

  it("all-zero phantom sha → false", async () => {
    expect(await git.catFileCommitExists(repo, "0000000000000000000000000000000000000000")).toBe(
      false,
    );
  });

  it("empty string → false", async () => {
    expect(await git.catFileCommitExists(repo, "")).toBe(false);
  });

  it("null → false", async () => {
    expect(await git.catFileCommitExists(repo, null)).toBe(false);
  });

  it("undefined → false", async () => {
    expect(await git.catFileCommitExists(repo, undefined)).toBe(false);
  });
});

describe("infra/git.ts — gitMergeBaseIsAncestor (spec T7.6 resume-declared-base validation)", () => {
  // helper: return the HEAD/HASH of the FIRST commit (gitInit's empty init commit).
  async function firstCommit(): Promise<string> {
    const all = await git.log(repo, { maxCount: 10 });
    const last = all!.filter((e) => e.message === "init");
    return last[last.length - 1].hash;
  }

  it("parent reaches HEAD → true (same ancestry the adoption lane trusts)", async () => {
    const parent = await firstCommit();
    writeFileSync(path.join(repo, "a.txt"), "a\n");
    gitCommit(repo, "second");
    const head = await git.revParseHead(repo);
    expect(head).not.toBeNull();
    expect(await git.mergeBaseIsAncestor(repo, parent, head!)).toBe(true);
  });

  it("HEAD itself is an ancestor of HEAD → true (reflexive; the adoption lane still requires != HEAD)", async () => {
    writeFileSync(path.join(repo, "a.txt"), "a\n");
    gitCommit(repo, "second");
    const head = await git.revParseHead(repo);
    expect(await git.mergeBaseIsAncestor(repo, head!, head!)).toBe(true);
  });

  it("descendant is NOT an ancestor of its parent (reachability is one-way) → false", async () => {
    writeFileSync(path.join(repo, "a.txt"), "a\n");
    gitCommit(repo, "second");
    const parent = await firstCommit();
    const head = await git.revParseHead(repo);
    expect(await git.mergeBaseIsAncestor(repo, head!, parent)).toBe(false);
  });

  it("all-zero phantom sha (40-hex but no real object) → false (fail-open)", async () => {
    expect(
      await git.mergeBaseIsAncestor(
        repo,
        "0000000000000000000000000000000000000000",
        (await git.revParseHead(repo)) ?? "",
      ),
    ).toBe(false);
  });

  it("non-git cwd → false (fail-open: an unguessable ancestry must never pass the adoption lane)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo-anc-"));
    try {
      expect(await git.mergeBaseIsAncestor(bare, "a".repeat(40), "b".repeat(40))).toBe(false);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
