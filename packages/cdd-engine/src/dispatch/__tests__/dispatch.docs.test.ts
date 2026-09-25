// packages/cdd-engine/src/dispatch/__tests__/dispatch.docs.test.ts
// (dispatch/docs.ts) inherits BOTH commit gates from the base (AC10 + spec-review-2 [2]), so a
// docs review/fix dispatch starts from a pre-commit clean tree (entry gate, gated pre-dispatch)
// and closes under the post-flight commit contract (exit gate — docs fix's formerly-missing exit
// gap, P5 落点 2). Covered here: the entry gate on the docs face (docs review 起点 dirty →
// BLOCKED — the acceptance's explicit case), the runDocsTask wrapper's ExitRequested(1) mapping,
// and the docs fix exit gate (dirty at return → handoff rewritten BLOCKED + exitCode 1). The
// docs handoff read / schema / finalize matrix stays owned by tests/docs-runner.test.mjs.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { captureStderr, captureStdout } from "../../infra/__tests__/helpers.ts";
import { ExitRequested } from "../../infra/exit.ts";
import { DRY_RUN_DIRTY_WARN } from "../../rules/commit.ts";
import { DispatchBlocked, type DispatchContext } from "../base.ts";
import { DocsLifecycle, runDocsTask } from "../docs.ts";

vi.mock("execa", () => ({ execa: vi.fn() }));

// Ghost harness registry (mirrors docs-runner.test.mjs): checkHarness resolves a fake entry with
// the review/fix injection map; invokeCli's resolveInjection comes from the real implementation.
vi.mock("../../infra/registry.ts", async () => {
  const actual =
    await vi.importActual<typeof import("../../infra/registry.ts")>("../../infra/registry.ts");
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
  renderTemplate: vi.fn(() => "mocked docs prompt body"),
  reviewHardGate: (ret: string) => `--hard-gate ${ret}`,
  docsFixHardGate: (hp: string) => `--hard-gate write ${hp}`,
}));

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-docs-ts-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  writeFileSync(path.join(dest, "tracked.txt"), "v1\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(
    dest,
    "-c",
    "user.name=cdd-docs-test",
    "-c",
    "user.email=cdd-docs-test@example.com",
    "commit",
    "-qm",
    "fixture",
  );
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
    harness: "ghost",
    mode: "review",
    template: "review",
    type: "spec",
    doc: path.join(repo, "spec.md"),
    handoffPath: path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json"),
    repoRoot: repo,
  });
  await expect(lc.run()).rejects.toBeInstanceOf(DispatchBlocked);
  // The template aborts in pre-flight at the entry gate; the docs agent spawn never happens.
  expect(lc.timeline).toEqual(["pre-flight", "commitPreCheck"]);
});

// E2②/G4①（P6 T10）: docs 面 dry-run 在脏树下降级（基类默认门单点，同 task 面）——CDD_WARN 后
// exit 0；且 dry-run 早退 resolveContext（不 dispatch、不 spawn）→ execa 零调用（无 liveness 介入，
// T14 接口消歧）+ 不写 handoff。真实 dispatch（上两用例 dryRun 缺省）保持 BLOCKED 语义不变。
it("docs review dry-run + dirty → 入口门降级：CDD_WARN + exit 0 + 零 spawn + 不写 handoff", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, "tracked.txt"), "dirty\n");
  const cap = captureStderr();
  try {
    const result = await runDocsTask({
      harness: "ghost",
      mode: "review",
      template: "review",
      type: "spec",
      doc: path.join(repo, "spec.md"),
      handoffPath: path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json"),
      repoRoot: repo,
      dryRun: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.handoff?.status).toBe("APPROVED"); // dry-run stub handoff（内存对象，不落盘）
  } finally {
    cap.restore();
  }
  expect(cap.text).toContain(`CDD_WARN: ${DRY_RUN_DIRTY_WARN}`); // mount 前缀 + 单点常量
  const { execa } = await import("execa");
  expect(vi.mocked(execa)).not.toHaveBeenCalled(); // 不 spawn → 零 liveness 介入（T14）
  expect(existsSync(path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json"))).toBe(
    false,
  ); // 不写 handoff
});

it("runDocsTask: 入口门 BLOCKED → CDD_BLOCKED stderr + ExitRequested(1)（CLI 面出口）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, "tracked.txt"), "dirty\n");
  const cap = captureStderr();
  try {
    await expect(
      runDocsTask({
        harness: "ghost",
        mode: "review",
        template: "review",
        type: "spec",
        doc: path.join(repo, "spec.md"),
        handoffPath: path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json"),
        repoRoot: repo,
        dryRun: false,
      }),
    ).rejects.toBeInstanceOf(ExitRequested);
  } finally {
    cap.restore();
  }
  expect(cap.text).toMatch(/CDD_BLOCKED: uncommitted changes at entry/);
});

it("docs fix 出口门（P5 落点 2）: 派发后 dirty → handoff 覆写 BLOCKED + exitCode 1", async () => {
  const repo = setupRepo();
  const doc = path.join(repo, "spec.md");
  writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
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
    wfs(
      handoffPath,
      JSON.stringify({
        phase: "fix",
        status: "APPROVED",
        findings: [],
        artifacts: {},
        doc_path: doc,
      }),
    );
    wfs(path.join(repo, "tracked.txt"), "v1\nv2\n");
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
  });
  const result = await runDocsTask({
    harness: "ghost",
    mode: "fix",
    template: "docs",
    type: "spec",
    doc,
    handoffPath,
    repoRoot: repo,
    dryRun: false,
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
  writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "doc");
  const handoffPath = path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json");
  const { execa } = await import("execa");
  vi.mocked(execa).mockImplementation(async () => {
    const { mkdirSync, writeFileSync: wfs } = await import("node:fs");
    mkdirSync(path.dirname(handoffPath), { recursive: true });
    wfs(
      handoffPath,
      JSON.stringify({
        phase: "review",
        status: "CHANGES_REQUESTED",
        findings: [{ severity: "warn", summary: "x" }],
        artifacts: {},
        doc_path: doc,
      }),
    );
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
  });
  const result = await runDocsTask({
    harness: "ghost",
    mode: "review",
    template: "review",
    type: "spec",
    doc,
    handoffPath,
    repoRoot: repo,
    dryRun: false,
  });
  expect(result.exitCode).toBe(0);
  // clean-tree review 出口门通过；engine 定稿覆写（warn-only → APPROVED）
  expect(result.handoff?.status).toBe("APPROVED");
});

// Docs-side failure takes priority in ordering (Task 23 fix-1, review-1 finding 1, warn): an agent
// nonzero exit + valid handoff written → exitCode = agent rc, so the failure signal is not masked
// by the finalization conclusion (before the fix, `finalized.exitCode` won unconditionally: a
// hand-written APPROVED conclusion → exit 0, splitting the task-side step 12 failure-first
// semantics). This case = red before the fix / green after.
it("docs review 失败优先: agent exit 1 + 有效 APPROVED handoff → exitCode = agent rc（失败不被定稿结论掩盖）", async () => {
  const repo = setupRepo();
  const doc = path.join(repo, "spec.md");
  writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "doc");
  const handoffPath = path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json");
  const { execa } = await import("execa");
  vi.mocked(execa).mockImplementation(async () => {
    const { mkdirSync, writeFileSync: wfs } = await import("node:fs");
    mkdirSync(path.dirname(handoffPath), { recursive: true });
    wfs(
      handoffPath,
      JSON.stringify({
        phase: "review",
        status: "APPROVED",
        findings: [],
        artifacts: {},
        doc_path: doc,
      }),
    );
    // 崩溃的 docs agent：手写 valid handoff 后非零退出（exit 1）
    return { exitCode: 1, stdout: "", stderr: "", timedOut: false };
  });
  const result = await runDocsTask({
    harness: "ghost",
    mode: "review",
    template: "review",
    type: "spec",
    doc,
    handoffPath,
    repoRoot: repo,
    dryRun: false,
  });
  // 失败优先：agent rc（1）胜出——handoff 定稿 APPROVED → 0 不吞掉失败信号。
  expect(result.exitCode).toBe(1);
  // 载体本身不受影响：定稿结论仍按 handoff 内容（引擎单点 statusExitCode 语义）。
  expect(result.handoff?.status).toBe("APPROVED");
});

it("T5 ③: docs dispatch injects DOCS_FIXED_POINT = dispatch entry base (git HEAD at dispatch time, lands in the renderTemplate params)", async () => {
  const repo = setupRepo();
  const doc = path.join(repo, "spec.md");
  writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "doc");
  const entryHead = git(repo, "rev-parse", "HEAD");
  const handoffPath = path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json");
  const { execa } = await import("execa");
  const { renderTemplate } = await import("../../render/templates.ts");
  vi.mocked(execa).mockResolvedValue({ exitCode: 0, stdout: "", stderr: "", timedOut: false });
  const result = await runDocsTask({
    harness: "ghost",
    mode: "review",
    template: "review",
    type: "spec",
    doc,
    handoffPath,
    repoRoot: repo,
    dryRun: false,
  });
  // review face (docs single dispatch point) passes the entry base into the round-context slot
  const params = renderTemplate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
  expect(params.DOCS_FIXED_POINT).toBe(entryHead);
  // non-git / unborn HEAD → empty (mode-union prefill)
  await runDocsTask({
    harness: "ghost",
    mode: "review",
    template: "review",
    type: "spec",
    doc: path.join(repo, "missing.md"),
    handoffPath: path.join(repo, ".osuperpowers", "cdd", "spec", "spec-review-1.json"),
    repoRoot: path.join(repo, "no-such-dir"),
    dryRun: false,
  });
  const lastParams = renderTemplate.mock.calls.at(-1)?.[1] as Record<string, unknown> | undefined;
  expect(lastParams?.DOCS_FIXED_POINT).toBe("");
  expect(result.exitCode).toBeGreaterThanOrEqual(0); // assertion surface is the render params, not the round conclusion
});

// Same-contract rounds behavioral determinism (T5 ⑤/AC6): docs fix one commit vs one uncommitted —
// the two rounds share the exit-gate contract and must behave consistently (commit → APPROVED
// exit 0; uncommitted → BLOCKED exit 1 + the diagnosis visible on stdout).
it("T5 ⑤: docs fix same-contract round behavior — commit → APPROVED; uncommitted → BLOCKED + stdout diagnosis", async () => {
  const repo = setupRepo();
  const doc = path.join(repo, "spec.md");
  writeFileSync(doc, "- **Version**: v1.0 · 2026-09-21\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "doc");
  const { execa } = await import("execa");

  // Round A — docs fix agent commits the change → clean tree + commits.head == HEAD → APPROVED exit 0
  const handoffA = path.join(repo, ".osuperpowers", "cdd", "spec", "spec-fix-1.json");
  vi.mocked(execa).mockImplementation(async () => {
    const { mkdirSync, writeFileSync: wfs } = await import("node:fs");
    mkdirSync(path.dirname(handoffA), { recursive: true });
    wfs(doc, "- **Version**: v1.1 · 2026-09-22\n");
    git(repo, "add", "-A");
    git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "docs fix");
    const head = git(repo, "rev-parse", "HEAD");
    const base = git(repo, "rev-parse", "HEAD~1");
    wfs(
      handoffA,
      JSON.stringify({
        phase: "fix",
        status: "APPROVED",
        findings: [],
        artifacts: {},
        doc_path: doc,
        commits: { base, head },
        changes: [{ file: "spec.md", reason: "T5 determinism round A" }],
      }),
    );
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
  });
  const resultA = await runDocsTask({
    harness: "ghost",
    mode: "fix",
    template: "docs",
    type: "spec",
    doc,
    handoffPath: handoffA,
    repoRoot: repo,
    dryRun: false,
  });
  expect(resultA.exitCode).toBe(0);
  expect(JSON.parse(readFileSync(handoffA, "utf8")).status).toBe("APPROVED");

  // Round B — same-contract docs fix agent leaves the change uncommitted → exit gate dirty → BLOCKED + stdout-visible diagnosis
  const handoffB = path.join(repo, ".osuperpowers", "cdd", "spec", "spec-fix-2.json");
  const entryHead = git(repo, "rev-parse", "HEAD");
  vi.mocked(execa).mockImplementation(async () => {
    const { mkdirSync, writeFileSync: wfs } = await import("node:fs");
    mkdirSync(path.dirname(handoffB), { recursive: true });
    wfs(doc, "- **Version**: v1.3 · 2026-09-22\n"); // change left uncommitted
    wfs(
      handoffB,
      JSON.stringify({
        phase: "fix",
        status: "APPROVED",
        findings: [],
        artifacts: {},
        doc_path: doc,
        commits: { base: entryHead, head: entryHead },
      }),
    );
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
  });
  const cap = captureStdout();
  let resultB: Awaited<ReturnType<typeof runDocsTask>>;
  try {
    resultB = await runDocsTask({
      harness: "ghost",
      mode: "fix",
      template: "docs",
      type: "spec",
      doc,
      handoffPath: handoffB,
      repoRoot: repo,
      dryRun: false,
    });
  } finally {
    cap.restore();
  }
  expect(resultB.exitCode).toBe(1);
  expect(JSON.parse(readFileSync(handoffB, "utf8")).status).toBe("BLOCKED");
  // stdout-visible diagnosis: uncommitted changes at return — commit before returning
  expect(cap.text).toMatch(/CDD_BLOCKED: uncommitted changes at return/);
  expect(cap.text).toContain("commit before returning");
});
