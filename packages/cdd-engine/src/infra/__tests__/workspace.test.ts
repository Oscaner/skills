// packages/cdd-engine/src/infra/__tests__/workspace.test.ts — the T6 workspace data-plane new suite:
// WorkspaceRoot (from / path / gitignorePath / ensure / for / enumerate) + Workspace (path / ensure /
// readJson / writeJson / progressPath / briefPath / lifecyclePath — the child-path single facts).
// The workspace-root derivation routes through the ConfigLoader namespace single source (config
// drift fails loudly); the for(doc) slug rule (-design/-plan single-layer strip) converges the
// spec/plan variants to one slug.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Workspace, WorkspaceRoot } from "../workspace.ts";

function tmpRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "ws-root-"));
}

describe("WorkspaceRoot — the repo-scoped workspace base", () => {
  it("from(repoRoot) → path = <repoRoot>/<workspaceRoot>; gitignorePath = <repoRoot>/.osuperpowers/.gitignore", () => {
    const repo = tmpRepo();
    const root = WorkspaceRoot.from(repo);
    // The workspaceRoot segment value comes from engine-config.json#handoffNamespace.workspaceRoot
    // (single source — no hard-coded literal).
    expect(root.workspaceRoot).toBe(".osuperpowers/cdd");
    expect(root.path).toBe(path.join(repo, ".osuperpowers", "cdd"));
    expect(root.gitignorePath).toBe(path.join(repo, ".osuperpowers", ".gitignore"));
  });

  it("ensure() → base dir created + root-level .gitignore (`*`) written; idempotent (第二次不炸)", () => {
    const repo = tmpRepo();
    const root = WorkspaceRoot.from(repo);
    root.ensure();
    expect(existsSync(root.path)).toBe(true);
    expect(readFileSync(root.gitignorePath, "utf8")).toBe("*\n");
    // idempotent re-run — same result, no throw.
    root.ensure();
    expect(existsSync(root.path)).toBe(true);
    expect(readFileSync(root.gitignorePath, "utf8")).toBe("*\n");
  });

  it("for(doc) — slug 派生唯一入口：-design/-plan 单层 strip 收敛", () => {
    const root = WorkspaceRoot.from("/repo");
    expect(root.for("docs/plans/2026-09-08-foo.md").slug).toBe("2026-09-08-foo");
    expect(root.for("2026-09-08-foo-design.md").slug).toBe("2026-09-08-foo");
    expect(root.for("2026-09-08-foo-plan.md").slug).toBe("2026-09-08-foo");
    // File-name-only derivation, no plan-file-existence dependency — the derived Workspace's path
    // mirrors the former resolveWorkspace.
    expect(root.for("2026-09-08-foo.md").path).toBe(
      path.join("/repo", ".osuperpowers", "cdd", "2026-09-08-foo"),
    );
  });

  it("for(doc) — 无法派生的 slug（空 / . / ..）→ run-blocked 拒绝", () => {
    const root = WorkspaceRoot.from("/repo");
    expect(() => root.for("planes/..")).toThrow(/cannot derive workspace name/);
    expect(() => root.for("/x/.md")).toThrow(/cannot derive workspace name/);
  });

  it("enumerate() — 读 workspace base 子目录（reapStale 全扫目标）；缺失 base → []；跳过文件", () => {
    const repo = tmpRepo();
    const root = WorkspaceRoot.from(repo);
    // no base yet → empty enumeration (the reapStale full-scan degrades safely).
    expect(root.enumerate()).toEqual([]);
    mkdirSync(path.join(root.path, "foo"), { recursive: true });
    mkdirSync(path.join(root.path, "bar"), { recursive: true });
    writeFileSync(path.join(root.path, "not-a-dir.json"), "{}");
    expect(root.enumerate().sort()).toEqual(["bar", "foo"]);
  });
});

describe("Workspace — one dispatch workspace", () => {
  it("path → <workspaceRoot>/<slug>; ensure() → mkdir {recursive}", () => {
    const repo = tmpRepo();
    const root = WorkspaceRoot.from(repo);
    const ws = root.for("docs/x.md");
    expect(ws.path).toBe(path.join(repo, ".osuperpowers", "cdd", "x"));
    expect(existsSync(ws.path)).toBe(false);
    ws.ensure();
    expect(existsSync(ws.path)).toBe(true);
  });

  it("child-path single facts: progressPath / briefPath / lifecyclePath", () => {
    const root = WorkspaceRoot.from("/repo");
    const ws = root.for("docs/x.md");
    expect(ws.progressPath).toBe(path.join("/repo", ".osuperpowers", "cdd", "x", "progress.json"));
    expect(ws.briefPath("1,2")).toBe(
      path.join("/repo", ".osuperpowers", "cdd", "x", "tasks-1,2-brief.md"),
    );
    // The lifecycle registry is PER-SLUG (T6 relocation) — never the repo-level single file.
    expect(ws.lifecyclePath).toBe(
      path.join("/repo", ".osuperpowers", "cdd", "x", "lifecycle.json"),
    );
  });

  it("writeJson / readJson — atomic JSON write (mkdir first) + fail-open read", () => {
    const repo = tmpRepo();
    const ws = WorkspaceRoot.from(repo).for("docs/x.md");
    // writeJson boots the slug dir itself (the single ensure point).
    ws.writeJson("progress.json", { plan: "/p", tasks: [] });
    expect(readFileSync(ws.progressPath, "utf8")).toBe(
      `${JSON.stringify({ plan: "/p", tasks: [] }, null, 2)}\n`,
    );
    expect(ws.readJson<{ plan: string }>("progress.json")?.plan).toBe("/p");
    expect(ws.readJson("missing.json")).toBeNull();
  });

  it("fromPath — path-only form (tests / rules-layer string contexts)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ws-frompath-"));
    const ws = Workspace.fromPath(dir);
    expect(ws.path).toBe(dir);
    ws.writeJson("x.json", { k: 1 });
    expect(ws.readJson<{ k: number }>("x.json")?.k).toBe(1);
  });
});
