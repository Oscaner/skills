// packages/cdd-engine/src-next/infra/__tests__/infra.test.ts
// T12 infra suite — the brief's checkables:
//   · resource+config — the logical-name path location (RESOURCE_SPECS-style) +
//     the steady-data config reads (path-location green);
//   · git — the single git seam over a real temp repo;
//   · process — the subprocess seam (fail-open results);
//   · workspace — the root/workspace pair + the slug rule + the JSON read/write.
// Fixtures live under mkdtemp (hermetic); the steady-data asserts read the
// living config files (the external contract JSONs are read-as-data, allowed —
// never the old tree's derived products).

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../config.ts";
import { GitClient } from "../git.ts";
import { ProcessRunner } from "../process.ts";
import type { ResourceName } from "../resource.ts";
import { RESOURCE_SPECS, ResourceResolver } from "../resource.ts";
import { Workspace, WorkspaceRoot } from "../workspace.ts";

describe("resource — the logical-name path location (RESOURCE_SPECS-style)", () => {
  it("resolves every logical resource to its source home under the package root", () => {
    const resolver = new ResourceResolver();
    const root = resolver.packageRoot();
    for (const name of Object.keys(RESOURCE_SPECS) as ResourceName[]) {
      expect(resolver.resolve(name)).toBe(path.join(root, ...RESOURCE_SPECS[name].source));
      expect(resolver.has(name), name).toBe(true);
    }
  });

  it("walks up from a fabricated install layout to the carrying package root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "infra-pkg-"));
    try {
      mkdirSync(path.join(root, "config"), { recursive: true });
      writeFileSync(path.join(root, "package.json"), "{}");
      writeFileSync(
        path.join(root, "config", "engine-config.json"),
        JSON.stringify({ handoffNamespace: { workspaceRoot: "test/ws" } }),
      );
      const resolver = new ResourceResolver(path.join(root, "config"));
      expect(resolver.packageRoot()).toBe(root);
      expect(resolver.resolve("engine-config")).toBe(
        path.join(root, "config", "engine-config.json"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("config — the steady-data reads", () => {
  it("reads the engine-config handoff-namespace (the workspace-root single source)", () => {
    const loader = new ConfigLoader();
    expect(loader.handoffNamespace().workspaceRoot).toBe(".kairos/cdd");
    expect(loader.engineConfig().$version).toBeGreaterThanOrEqual(1);
  });

  it("reads the harness + template contracts as steady data", () => {
    const loader = new ConfigLoader();
    expect(loader.harnessContract().claude).toBeDefined();
    const template = loader.templateContract();
    expect(template.skeleton.order).toEqual(["shell", "return", "round-context"]);
    expect(Object.keys(template.sections.return)).toEqual([
      "RETURN_STDOUT_BLOCK",
      "RETURN_JSON",
      "DOCS_FIX",
    ]);
  });
});

describe("git — the single git seam over a real temp repo", () => {
  it("walks init → dirty → commit → clean over one repo (fail-open)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "infra-git-"));
    try {
      const proc = new ProcessRunner();
      await proc.run("git", ["init", "-b", "main", dir]);
      await proc.run("git", ["config", "user.email", "tester@example.dev"], dir);
      await proc.run("git", ["config", "user.name", "Tester"], dir);
      const git = new GitClient();
      expect(await git.topLevel(dir)).toBe(realpathSync(dir));
      expect(await git.revParseHead(dir)).toBeNull(); // no commits — no HEAD
      writeFileSync(path.join(dir, "a.txt"), "a\n");
      expect(await git.isClean(dir)).toBe(false);
      const head = await git.commit(dir, "feat: initial");
      expect(head).toMatch(/^[0-9a-f]{40}$/);
      expect(await git.revParseHead(dir)).toBe(head);
      expect(await git.isClean(dir)).toBe(true);
      const log = await git.log(dir);
      expect(log?.[0]?.hash).toBe(head);
      expect(log?.[0]?.message).toBe("feat: initial");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails open outside a git repo (no exception crosses the seam)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "infra-nogit-"));
    try {
      const git = new GitClient();
      expect(await git.topLevel(dir)).toBeNull();
      expect(await git.revParseHead(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("process — the subprocess seam", () => {
  it("captures a successful run's stdout", async () => {
    const result = await new ProcessRunner().run("node", ["-e", "console.log('hello')"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("hello");
  });

  it("rides a synthetic code for a non-zero exit and a missing binary (fail-open)", async () => {
    const proc = new ProcessRunner();
    const failing = await proc.run("node", ["-e", "process.exit(3)"]);
    expect(failing.code).toBe(3);
    const missing = await proc.run("definitely-not-a-binary-xyz", []);
    expect(missing.code).not.toBe(0);
  });
});

describe("workspace — the root/workspace pair + the slug rule + JSON roundtrip", () => {
  it("derives paths and roundtrips JSON reads/writes under the slug dir", () => {
    const base = mkdtempSync(path.join(tmpdir(), "infra-ws-"));
    try {
      const root = new WorkspaceRoot(base, ".kairos/cdd");
      const workspace = new Workspace(root, "test-slug");
      expect(workspace.path).toBe(path.join(base, ".kairos", "cdd", "test-slug"));
      workspace.writeJson("probe.json", { a: 1 });
      expect(workspace.readJson<{ a: number }>("probe.json")).toEqual({ a: 1 });
      expect(workspace.readJson("missing.json")).toBeNull();
      expect(workspace.resolve("probe.json")).toBe(path.join(workspace.path, "probe.json"));
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("derives the slug from a doc file name — single-layer -design/-plan strip", () => {
    expect(Workspace.slugFromDoc("2026-10-02-x-p3-design.md")).toBe("2026-10-02-x-p3");
    expect(Workspace.slugFromDoc("2026-10-02-x-p3-plan.md")).toBe("2026-10-02-x-p3");
    expect(Workspace.slugFromDoc("2026-10-02-x-overall.md")).toBe("2026-10-02-x-overall");
    expect(Workspace.slugFromDoc("notes.md")).toBe("notes");
  });
});
