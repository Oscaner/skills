// packages/cdd-engine/src/dispatch/__tests__/dispatch.docs.test.ts
// (dispatch/docs.ts) inherits BOTH commit gates from the base (AC10 + spec-review-2 [2]), so a
// docs review/fix dispatch starts from a pre-commit clean tree (entry gate, gated pre-dispatch)
// and closes under the post-flight commit contract (exit gate — docs fix's formerly-missing exit
// gap, P5 落点 2). Covered here: the entry gate on the docs face (docs review 起点 dirty →
// BLOCKED — the acceptance's explicit case), the runDocsTask wrapper's ExitRequested(1) mapping,
// and the docs fix exit gate (dirty at return → handoff rewritten BLOCKED + exitCode 1). The
// docs handoff read / schema / finalize matrix stays owned by tests/docs-runner.test.mjs.
import { it, expect, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { DocsLifecycle, runDocsTask } from "../docs.ts";
import { DispatchBlocked, type DispatchContext } from "../base.ts";
import { ExitRequested } from "../../infra/exit.ts";

vi.mock("execa", () => ({ execa: vi.fn() }));

// Ghost harness registry (mirrors docs-runner.test.mjs): checkHarness resolves a fake entry with
// the review/fix injection map; invokeCli's resolveInjection comes from the real implementation.
vi.mock("../../infra/registry.ts", async () => {
  const actual = await vi.importActual<typeof import("../../infra/registry.ts")>("../../infra/registry.ts");
  return {
    ...actual,
    loadRegistry: vi.fn(() => ({})),
    checkHarness: vi.fn(() => ({
      cli: "fake-cli",
      invoke: "-p --output-format text",
      output: "text",
      prefix: { review: { spec: "", plan: "" }, fix: "" },
      suffix: {},
    })),
    REG_PATH: actual.REG_PATH,
  };
});
vi.mock("../../render/templates.ts", () => ({
  renderTemplate: () => "mocked docs prompt body",
  renderHandoffStub: () => "{\"stub\":true}",
  reviewHardGate: (ret: string) => `--hard-gate ${ret}`,
  docsFixHardGate: (hp: string) => `--hard-gate write ${hp}`,
}));

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-docs-ts-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  writeFileSync(path.join(dest, "tracked.txt"), "v1\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(dest, "-c", "user.name=cdd-docs-test", "-c", "user.email=cdd-docs-test@example.com", "commit", "-qm", "fixture");
  return dest;
}

function docsCtx(repo: string, handoffPath: string): DispatchContext {
  return { mode: "review", repoRoot: repo, handoffPath };
}

it("docs review 起点 dirty → 入口门 BLOCKED（dispatch 不进入；spec-review-2 [2] 同消费双门）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, "tracked.txt"), "dirty\n");
  const lc = new DocsLifecycle({
    ctx: docsCtx(repo, path.join(repo, "spec-review-1.json")),
    harness: "ghost", mode: "review", template: "review", type: "spec", doc: path.join(repo, "spec.md"),
    handoffPath: path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json"),
    repoRoot: repo,
  });
  await expect(lc.run()).rejects.toBeInstanceOf(DispatchBlocked);
  // The template aborts in pre-flight at the entry gate; the docs agent spawn never happens.
  expect(lc.timeline).toEqual(["pre-flight", "commitPreCheck"]);
});

it("runDocsTask: 入口门 BLOCKED → CDD_BLOCKED stderr + ExitRequested(1)（CLI 面出口）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, "tracked.txt"), "dirty\n");
  const stderrBuf: string[] = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((s: unknown) => { stderrBuf.push(String(s)); return true; }) as typeof process.stderr.write;
  try {
    await expect(runDocsTask({
      harness: "ghost", mode: "review", template: "review", type: "spec", doc: path.join(repo, "spec.md"),
      handoffPath: path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json"),
      repoRoot: repo, dryRun: false,
    })).rejects.toBeInstanceOf(ExitRequested);
  } finally {
    process.stderr.write = origWrite;
  }
  expect(stderrBuf.join("")).toMatch(/CDD_BLOCKED: uncommitted changes at entry/);
});

it("docs fix 出口门（P5 落点 2）: 派发后 dirty → handoff 覆写 BLOCKED + exitCode 1", async () => {
  const repo = setupRepo();
  const doc = path.join(repo, "spec.md");
  writeFileSync(doc, "# spec\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "doc");
  const handoffPath = path.join(repo, ".osuperpowers", "cdd", "spec", "spec-fix-1.json");
  const dir = path.dirname(handoffPath);
  // The docs fix agent writes the fix handoff AND dirties the tree during dispatch (entry clean →
  // exit dirty): the exit gate must rewrite the handoff to BLOCKED (the fix agent forgot to commit).
  const { execa } = await import("execa");
  vi.mocked(execa).mockImplementation(async () => {
    const { mkdirSync, writeFileSync: wfs } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    wfs(handoffPath, JSON.stringify({
      phase: "fix", status: "APPROVED", findings: [], artifacts: {}, doc_path: doc,
    }));
    wfs(path.join(repo, "tracked.txt"), "v1\nv2\n");
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
  });
  const result = await runDocsTask({
    harness: "ghost", mode: "fix", template: "docs", type: "spec", doc,
    handoffPath, repoRoot: repo, dryRun: false,
  });
  expect(result.exitCode).toBe(1);
  expect(existsSync(handoffPath)).toBe(true);
  const h = JSON.parse(readFileSync(handoffPath, "utf8"));
  expect(h.status).toBe("BLOCKED");
  expect(h.blocker).toMatch(/uncommitted changes at return/);
});

it("docs review 出口门: clean tree 通过 + result 原样（exitCode = agent rc）", async () => {
  const repo = setupRepo();
  const doc = path.join(repo, "spec.md");
  writeFileSync(doc, "# spec\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "doc");
  const handoffPath = path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json");
  const { execa } = await import("execa");
  vi.mocked(execa).mockImplementation(async () => {
    const { mkdirSync, writeFileSync: wfs } = await import("node:fs");
    mkdirSync(path.dirname(handoffPath), { recursive: true });
    wfs(handoffPath, JSON.stringify({
      phase: "review", status: "CHANGES_REQUESTED", findings: [{ severity: "warn", summary: "x" }], artifacts: {}, doc_path: doc,
    }));
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
  });
  const result = await runDocsTask({
    harness: "ghost", mode: "review", template: "review", type: "spec", doc,
    handoffPath, repoRoot: repo, dryRun: false,
  });
  expect(result.exitCode).toBe(0);
  // clean-tree review 出口门通过；engine 定稿覆写（warn-only → APPROVED）
  expect(result.handoff?.status).toBe("APPROVED");
});