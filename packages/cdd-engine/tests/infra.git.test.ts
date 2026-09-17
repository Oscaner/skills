// tests/infra.git.test.ts — TS infra layer: simple-git single-point wrapper.
// Spec §2.13 git row: status/add/commit/head/log replace the hand-written
// hand-written git subprocess helpers in rules/commit.mjs. Fail-open contracts mirror
// the old helpers (non-repo / git error → null / false).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { gitInit, gitCommit } from "./helpers.mjs";
import { gitTopLevel, gitRevParseHead, gitStatusPorcelain, gitAdd, gitCommit as sgCommit, gitLog, gitCatFileCommitExists } from "../src/infra/git.ts";

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
    const top = await gitTopLevel(repo);
    expect(String(top)).toMatch(/^\/.+infra-git-/);
  });

  it("non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo-"));
    try {
      expect(await gitTopLevel(bare)).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("infra/git.ts — gitRevParseHead", () => {
  it("temp repo → 40-hex sha matching git rev-parse HEAD", async () => {
    const head = await gitRevParseHead(repo);
    const actual = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    expect(head).toBe(actual);
    expect(String(head)).toMatch(/^[0-9a-f]{40}$/);
  });

  it("non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo2-"));
    try {
      expect(await gitRevParseHead(bare)).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("infra/git.ts — gitStatusPorcelain", () => {
  it("clean tree → empty string", async () => {
    expect(await gitStatusPorcelain(repo)).toBe("");
  });

  it("untracked file → non-empty porcelain", async () => {
    writeFileSync(path.join(repo, "untracked.txt"), "x\n");
    const p = await gitStatusPorcelain(repo);
    expect(p).toContain("untracked.txt");
  });

  it("non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo3-"));
    try {
      expect(await gitStatusPorcelain(bare)).toBeNull();
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
    expect(await gitAdd(repo, ["added.txt"])).toBe(true);
    expect(await gitStatusPorcelain(repo)).toContain("added.txt");
    const headBefore = await gitRevParseHead(repo);
    const sha = await sgCommit(repo, "add added.txt");
    expect(String(sha)).toMatch(/^[0-9a-f]{40}$/);
    const headAfter = await gitRevParseHead(repo);
    expect(headAfter).toBe(sha);
    expect(headAfter).not.toBe(headBefore);
    expect(await gitStatusPorcelain(repo)).toBe("");
  });

  it("gitCommit in non-git dir → null (fail-open)", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-git-norepo4-"));
    try {
      expect(await sgCommit(bare, "nope")).toBeNull();
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
    const entries = await gitLog(repo, { maxCount: 2 });
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
      expect(await gitLog(bare, {})).toBeNull();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("infra/git.ts — gitCatFileCommitExists", () => {
  it("real HEAD sha → true", async () => {
    const sha = await gitRevParseHead(repo);
    expect(sha).not.toBeNull();
    expect(await gitCatFileCommitExists(repo, sha!)).toBe(true);
  });

  it("all-zero phantom sha → false", async () => {
    expect(await gitCatFileCommitExists(repo, "0000000000000000000000000000000000000000")).toBe(false);
  });

  it("empty string → false", async () => {
    expect(await gitCatFileCommitExists(repo, "")).toBe(false);
  });

  it("null → false", async () => {
    expect(await gitCatFileCommitExists(repo, null)).toBe(false);
  });

  it("undefined → false", async () => {
    expect(await gitCatFileCommitExists(repo, undefined)).toBe(false);
  });
});
