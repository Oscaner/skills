// packages/cdd-engine/src-next/infra/__tests__/infra.test.ts
// T12 infra suite + T21 typed-plane migration:
//   · runtime — the typed engine-config surface (the argv channel table + the handoff
//     namespace: workspace-root segment + the family naming table), single-source
//     asserts (the data lives in the typed module — zero config-home reads);
//   · config — the ConfigLoader typed accessor facade (the consumer surface the
//     retired loader kept: engineConfig / harnessContract / templateContract /
//     handoffNamespace — now the typed planes' single home);
//   · git — the single git seam over a real temp repo;
//   · process — the subprocess seam (fail-open results);
//   · workspace — the root/workspace pair + the slug rule + the JSON read/write.

import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DISPATCH, HOSTS, REFS } from "../../face/host.ts";
import { REVIEWS, TEMPLATE_PROMPT } from "../../render/templates.ts";
import { ConfigLoader } from "../config.ts";
import { GitClient } from "../git.ts";
import { ProcessRunner } from "../process.ts";
import { ARGV_CHANNEL, ENGINE_RUNTIME, HANDOFF_FAMILIES } from "../runtime.ts";
import { Workspace, WorkspaceRoot } from "../workspace.ts";

describe("runtime — the typed engine-config surface (the typed data plane)", () => {
  it("carries the engine runtime facts — version, the argv channel, the handoff namespace", () => {
    expect(ENGINE_RUNTIME.$version).toBeGreaterThanOrEqual(1);
    expect(ENGINE_RUNTIME.handoffNamespace.workspaceRoot).toBe(".kairos/cdd");
    // The CLI channel table — the flag/type/enum single source (tasks / type enum).
    expect(ARGV_CHANNEL.tasks).toEqual({ flag: "--tasks", type: "int-list" });
    expect(ARGV_CHANNEL.type.values).toEqual(["task", "branch", "spec", "plan"]);
    expect(ARGV_CHANNEL.help).toEqual({
      flag: "--help",
      alias: "-h",
      type: "bool",
      scope: "program",
    });
  });

  it("carries the handoff family naming table — every op.type the ledger resolves", () => {
    expect(HANDOFF_FAMILIES["implement.task"].name).toBe("tasks-{tasks}-implement.json");
    expect(HANDOFF_FAMILIES["review.task"].name).toBe("tasks-{tasks}-review-{round}.json");
    // v1.9 — the family `schema` faces select the handoff-schema subset (§3.6: the
    // field resurrected from the dead task/docs discrimination), and the return-format
    // field is gone (RETURN_STDOUT_BLOCK is the ONE return contract). The docs-fix
    // families (fix.spec/fix.plan) ride the findings face — §3.6's per-mode split.
    expect(HANDOFF_FAMILIES["review.branch"].schema).toBe("findings");
    expect(HANDOFF_FAMILIES["fix.plan"].schema).toBe("findings");
    expect(HANDOFF_FAMILIES["implement.task"].schema).toBe("work");
    expect(HANDOFF_FAMILIES["fix.task"].schema).toBe("work");
    for (const key of [
      "implement.task",
      "review.task",
      "fix.task",
      "review.spec",
      "fix.spec",
      "review.plan",
      "fix.plan",
      "review.branch",
      "fix.branch",
    ] as const satisfies readonly (keyof typeof HANDOFF_FAMILIES)[]) {
      expect(HANDOFF_FAMILIES[key], key).toBeDefined();
    }
    // the return-format field is deleted with the divided return faces (the type-level
    // assertion — a re-added field would fail the compile)
  });

  it("declares the single-source channel/marker facts with zero duplication (host markers in host.ts only)", () => {
    // The host-marker closure derives from the harness detect rows (face/host.ts) —
    // the runtime carries the argv channel only; the marker env keys appear in no
    // runtime/argv row (single source, no second declaration).
    const argvText = JSON.stringify(ARGV_CHANNEL);
    for (const marker of ["CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "AI_AGENT"]) {
      expect(argvText, marker).not.toContain(marker);
    }
  });
});

describe("config — the typed accessor facade (one no-I/O route per face)", () => {
  it("routes the engine-config face — the handoff namespace + version", () => {
    const loader = new ConfigLoader();
    expect(loader.handoffNamespace().workspaceRoot).toBe(".kairos/cdd");
    expect(loader.engineConfig().$version).toBeGreaterThanOrEqual(1);
  });

  it("routes the harness + template faces — the typed host contract + dispatch prompt", () => {
    const loader = new ConfigLoader();
    expect(loader.harnessContract().hosts.claude.detect.env).toBe("CLAUDE_CODE_SESSION_ID");
    expect(loader.harnessContract().hosts.claude.promptForm).toBe("ref-prefixed");
    expect(loader.harnessContract().dispatch.implement).toBe("mattpocock-skills:implement");
    expect(loader.harnessContract().refs["mattpocock-skills:code-review"].pi).toBe(
      "/skill:code-review",
    );
    const template = loader.templateContract();
    // v1.8 — the mode 分派表 (implement/fix/review/docs-fix) + the single return contract
    // (RETURN_JSON / DOCS_FIX 退役)
    expect(Object.keys(template.modes)).toEqual(["implement", "fix", "review", "docs-fix"]);
    expect(Object.keys(template.return)).toEqual(["RETURN_STDOUT_BLOCK"]);
  });

  it("carries the P5 review criteria — the typed dispatch rows + axes guides with zero forbidden prose", () => {
    // The task/branch dispatch rows name their ref only (the parallel-sub-agents note is deleted).
    expect(DISPATCH.review.task).toEqual({ ref: "mattpocock-skills:code-review" });
    expect(DISPATCH.review.branch).toEqual({ ref: "mattpocock-skills:code-review" });
    // The spec/plan rows carry the URC three axes + the writing-plans self-check + the
    // verification-evidence duty.
    expect(DISPATCH.review.spec).toContain("completeness/consistency/clarity");
    expect(DISPATCH.review.spec).toContain("writing-plans self-check");
    expect(DISPATCH.review.spec).toContain("verification evidence");
    expect(DISPATCH.review.plan).toContain("completeness/decomposition/buildability");
    // The implement slot is the M1 supersede — mattpocock-skills:implement, registered in refs.
    expect(DISPATCH.implement).toBe("mattpocock-skills:implement");
    expect(REFS["mattpocock-skills:implement"].claude).toBe("/mattpocock-skills:implement");
    expect(REFS["mattpocock-skills:implement"].pi).toBe("/skill:implement");
    // The forbidden prose is gone from every review surface.
    const reviewText = JSON.stringify({ ...DISPATCH.review, ...REVIEWS });
    expect(reviewText).not.toContain("parallel sub-agents");
    // The axes guides carry the verification-evidence duty.
    expect(REVIEWS.task.axesGuide).toContain("dual evidence");
    expect(REVIEWS.branch.axesGuide).toContain("dual evidence");
    expect(TEMPLATE_PROMPT.modes.implement.shell.join("\n")).toContain(
      "mattpocock-skills:implement",
    );
    // Zero $schema/_doc prose in the typed planes.
    expect(JSON.stringify(ENGINE_RUNTIME)).not.toContain("$schema");
    expect(JSON.stringify(ENGINE_RUNTIME)).not.toContain('"_doc"');
    expect(JSON.stringify(HOSTS)).not.toContain("$schema");
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
