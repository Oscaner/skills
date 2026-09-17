// tests/infra.root.test.ts — TS infra layer: repoRoot single cwd conversion point (spec §2.13 infra row).
// Guard note: src/infra/root.ts is validate's sole process.cwd() anchor (channel audit ①). The
// TS port takes cwd as an explicit parameter — no new process.cwd() token — and resolves the repo
// root via infra/git.ts (gitTopLevel), the single git point for the rebuilt layer.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { gitInit } from "./helpers.mjs";
import { initRoot, getRoot, resolveDocArg } from "../src/infra/root.ts";

let repo: string;

function captureError<T extends Error>(fn: () => T): Promise<{ err: T & { code?: number }; stderr: string }> {
  const origWrite = process.stderr.write.bind(process.stderr);
  let stderr = "";
  process.stderr.write = ((s: unknown) => { stderr += String(s); return true; }) as typeof process.stderr.write;
  try {
    try {
      fn();
    } catch (e) {
      return { err: e as T & { code?: number }, stderr };
    } finally {
      process.stderr.write = origWrite;
    }
    throw new Error("expected fn to throw");
  } finally {
    process.stderr.write = origWrite;
  }
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), "infra-root-"));
  gitInit(repo);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("infra/root.ts — initRoot(cwd)", () => {
  it("getRoot before initRoot → throws (message names initRoot)", () => {
    // module _root starts null; must be asserted BEFORE any initRoot call caches it
    const { err } = captureError(() => getRoot() as never);
    expect(String(err.message)).toMatch(/initRoot/);
  });

  it("temp git repo → resolves repo root (via infra/git.ts gitTopLevel)", async () => {
    const root = await initRoot(repo);
    expect(String(root)).toMatch(/^\//);
    expect(String(root)).toContain("infra-root-");
  });

  it("getRoot after initRoot → same cached value", async () => {
    const root = await initRoot(repo);
    expect(getRoot()).toBe(root);
  });

  it("non-git dir → CDD_BLOCKED stderr + ExitRequested code 1", async () => {
    const bare = mkdtempSync(path.join(tmpdir(), "infra-root-norepo-"));
    const origWrite = process.stderr.write.bind(process.stderr);
    let stderr = "";
    process.stderr.write = ((s: unknown) => { stderr += String(s); return true; }) as typeof process.stderr.write;
    try {
      await expect(initRoot(bare)).rejects.toMatchObject({ code: 1 });
    } finally {
      process.stderr.write = origWrite;
      rmSync(bare, { recursive: true, force: true });
    }
    expect(stderr).toMatch(/CDD_BLOCKED: not in a git repository/);
  });
});

describe("infra/root.ts — resolveDocArg (same single-coordinate contract as root.mjs)", () => {
  it("repo-root-relative existing path → absolute", () => {
    const rel = "docs/osuperpowers/specs/foo.md";
    mkdirSync(path.join(repo, "docs/osuperpowers/specs"), { recursive: true });
    writeFileSync(path.join(repo, rel), "# x\n");
    expect(resolveDocArg(rel, repo, "path")).toBe(path.join(repo, rel));
  });

  it("absolute existing path → passthrough", () => {
    mkdirSync(path.join(repo, "docs"), { recursive: true });
    const abs = path.join(repo, "docs/abs.md");
    writeFileSync(abs, "# x\n");
    expect(resolveDocArg(abs, repo, "spec")).toBe(abs);
  });

  it("missing repo-root-relative → CDD_BLOCKED 3 lines + ExitRequested 1", () => {
    const { err, stderr } = captureError(() => {
      resolveDocArg("docs/nope.md", repo, "spec");
      return undefined as never;
    });
    expect(err.code).toBe(1);
    const lines = stderr.trimEnd().split("\n");
    expect(lines).toHaveLength(3);
    expect(stderr).toMatch(/CDD_BLOCKED: --spec not found: docs\/nope\.md/);
    expect(stderr).toMatch(/Hint: cdd resolves paths against the repo root/);
  });

  it("missing absolute → CDD_BLOCKED absolute wording + ExitRequested 1", () => {
    const abs = path.join(repo, "docs/nope-abs.md");
    const { err, stderr } = captureError(() => {
      resolveDocArg(abs, repo, "spec");
      return undefined as never;
    });
    expect(err.code).toBe(1);
    expect(stderr).toMatch(/Absolute path does not exist\./);
    expect(stderr).not.toMatch(/Tried \(against repo root/);
  });
});
