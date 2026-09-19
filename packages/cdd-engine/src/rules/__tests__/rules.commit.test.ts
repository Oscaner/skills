// packages/cdd-engine/src/rules/__tests__/rules.commit.test.ts
// rebuild). Ports the legacy commit-contract semantic matrix from contract.test.mjs onto the
// simple-git-backed implementation (infra/git.ts): dirty → BLOCKED / head mismatch / review
// skip / fail-open — the API bottom-swap claim's sole owner — plus the NEW entry-gate judgment
// (pre-commit clean-tree, spec §2.12 第二部分).
// NOT covered here (out of this task's claim, single owner = Task 7 dispatch/base.ts):
// lifecycle mounting of either gate and its CLI-level use-cases.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  validateCommitContract,
  entryGateCleanTree,
  rewriteHandoffBlocked,
  DRY_RUN_DIRTY_WARN,
} from "../commit.ts";
import { gitCatFileCommitExists } from "../../infra/git.ts";

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// setupRepo — fresh git repo, cdd/ gitignored (workspace dir), one fixture commit.
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-commit-ts-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(dest, "-c", "user.name=cdd-gate-test", "-c", "user.email=cdd-gate-test@example.com", "commit", "--allow-empty", "-qm", "fixture");
  return dest;
}

// seedHandoff — plant a handoff under the gitignored cdd/ (does not dirty the tracked tree).
function seedHandoff(repo: string, task: number, commits: { base: string; head: string }): string {
  const dir = path.join(repo, "cdd");
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `task-${task}-handoff.json`);
  writeFileSync(p, JSON.stringify({ status: "DONE", phase: "implement", task, commits }));
  return p;
}

function headOf(repo: string): string {
  return git(repo, "rev-parse", "HEAD");
}

describe("rules/commit.ts — 出口门 validateCommitContract（仅底层换 simple-git，语义逐字不变）", () => {
  it("dirty implement → ok:false（uncommitted changes at return）", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
    const r = await validateCommitContract("implement", repo);
    expect(r.ok).toBe(false);
    expect(r.blocker).toMatch(/uncommitted changes at return/);
  });

  it("clean tree → ok:true（handoff 不重写）", async () => {
    const repo = setupRepo();
    const head = headOf(repo);
    const handoff = seedHandoff(repo, 1, { base: head, head });
    const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
    expect(r.ok).toBe(true);
    expect(JSON.parse(readFileSync(handoff, "utf8")).status).toBe("DONE");
  });

  it("clean tree + handoff status APPROVED 不变（validateCommitContract 改经内存归一，不落盘）", async () => {
    const repo = setupRepo();
    const head = headOf(repo);
    const handoff = path.join(repo, "cdd", "task-1-handoff.json");
    mkdirSync(path.join(repo, "cdd"), { recursive: true });
    writeFileSync(handoff, JSON.stringify({ status: "APPROVED", phase: "fix", task: 1, commits: { base: head, head } }));
    const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
    expect(r.ok).toBe(true);
    expect(JSON.parse(readFileSync(handoff, "utf8")).status).toBe("APPROVED");
  });

  it("clean tree + 无 handoff 路径（readJson null）→ ok:true（fail-open）", async () => {
    const repo = setupRepo();
    const r = await validateCommitContract("implement", repo, { handoffPath: path.join(repo, "cdd", "no-such.json") });
    expect(r.ok).toBe(true);
  });

  it("clean tree + handoff.head ≠ HEAD → ok:false + handoff 改写 BLOCKED（F1）", async () => {
    const repo = setupRepo();
    const head = headOf(repo);
    const handoff = seedHandoff(repo, 1, { base: head, head: "0000000000000000000000000000000000000000" });
    const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
    expect(r.ok).toBe(false);
    expect(r.blocker).toMatch(/handoff commits.head .* does not match HEAD/);
    expect(JSON.parse(readFileSync(handoff, "utf8")).status).toBe("BLOCKED");
  });

  it("handoff.head=dry-run → head-mismatch（哨兵已移除，对齐 bash）", async () => {
    const repo = setupRepo();
    const handoff = seedHandoff(repo, 1, { base: "dry-run", head: "dry-run" });
    const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
    expect(r.ok).toBe(false);
    expect(r.blocker).toMatch(/handoff commits.head dry-run does not match HEAD/);
  });

  it("#186: handoff.head=7-char prefix of HEAD → ok:true（prefix fallback）", async () => {
    const repo = setupRepo();
    const head = headOf(repo);
    const handoff = seedHandoff(repo, 1, { base: head, head: head.slice(0, 7) });
    const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
    expect(r.ok).toBe(true);
  });

  it("#186: handoff.head=non-prefix 7-char → ok:false（mismatch）", async () => {
    const repo = setupRepo();
    const head = headOf(repo);
    const handoff = seedHandoff(repo, 1, { base: head, head: "0000000" });
    const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
    expect(r.ok).toBe(false);
    expect(r.blocker).toMatch(/does not match HEAD/);
  });

  it("review 模式 → dirty tree BLOCKED（review 亦校验 dirty）", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
    const r = await validateCommitContract("review", repo);
    expect(r.ok).toBe(false);
    expect(r.blocker).toMatch(/uncommitted changes at return \(review\)/);
  });

  it("review 模式 → clean tree 跳过 head 校验（handoff.commits.head≠HEAD 不 BLOCKED）", async () => {
    const repo = setupRepo();
    const head = headOf(repo);
    const handoff = seedHandoff(repo, 1, { base: head, head: "0000000000000000000000000000000000000000" });
    const r = await validateCommitContract("review", repo, { handoffPath: handoff });
    expect(r.ok).toBe(true);
  });

  it("非 git 目录 → fail-open ok:true", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-nogit-ts-"));
    const r = await validateCommitContract("fix", dir, { handoffPath: path.join(dir, "task-1-handoff.json") });
    expect(r.ok).toBe(true);
  });

  it("无 repoRoot → fail-open ok:true（不得误检 caller cwd）", async () => {
    expect((await validateCommitContract("implement", null)).ok).toBe(true);
  });

  it("未知 mode 名 → no-op ok:true", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
    const r = await validateCommitContract("bogus", repo);
    expect(r.ok).toBe(true);
  });

  it("gitCatFileCommitExists（infra 底层）：real commit → true / phantom → false / 空 → false", async () => {
    const repo = setupRepo();
    const sha = headOf(repo);
    expect(await gitCatFileCommitExists(repo, sha)).toBe(true);
    expect(await gitCatFileCommitExists(repo, "0000000000000000000000000000000000000000")).toBe(false);
    expect(await gitCatFileCommitExists(repo, "")).toBe(false);
  });
});

describe("rules/commit.ts — 入口门 entryGateCleanTree（pre-commit 干净树判定）", () => {
  it("clean tree → ok:true", async () => {
    const repo = setupRepo();
    expect(await entryGateCleanTree(repo)).toEqual({ ok: true, blocker: "" });
  });

  it("dirty tree → ok:false（BLOCKED 信号；指引提交/丢弃后重试）", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
    const r = await entryGateCleanTree(repo);
    expect(r.ok).toBe(false);
    expect(r.blocker).toMatch(/uncommitted changes at entry/);
  });

  // E2②/G4①（P6 T10）: dry-run 门判 WARN 化——脏树在 dryRun 下降级为 warn 而非 BLOCK（纯模拟
  // 零副作用，脏树无法破坏模拟）；真实 dispatch（dryRun 缺省/关）保持硬 BLOCK。fail-open 两面
  //（非 git / 无 root）在 dryRun 下与真实 dispatch 同面：无仓库 → 无树可判 → 无 warn。
  it("dirty tree + dryRun → ok:true + warn 消息（不 BLOCK；模拟走完）", async () => {
    const repo = setupRepo();
    appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
    const r = await entryGateCleanTree(repo, { dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.blocker).toBe("");
    expect(r.warn).toBe(DRY_RUN_DIRTY_WARN); // 单点常量：判断与测试共享同一措辞（重写即双面同步红）
  });

  it("clean tree + dryRun → ok:true 且无 warn（干净树无降级可言）", async () => {
    const repo = setupRepo();
    const r = await entryGateCleanTree(repo, { dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.blocker).toBe("");
    expect(r.warn).toBeUndefined();
  });

  it("非 git 目录 → fail-open ok:true", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-entry-nogit-"));
    expect(await entryGateCleanTree(dir)).toEqual({ ok: true, blocker: "" });
    expect(await entryGateCleanTree(dir, { dryRun: true })).toEqual({ ok: true, blocker: "" });
  });

  it("无 repoRoot → fail-open ok:true", async () => {
    expect(await entryGateCleanTree(null)).toEqual({ ok: true, blocker: "" });
    expect(await entryGateCleanTree(null, { dryRun: true })).toEqual({ ok: true, blocker: "" });
  });
});

describe("rules/commit.ts — rewriteHandoffBlocked（BLOCKED 重写载荷）", () => {
  it("有 path → status=BLOCKED + blocker + artifacts:{} 覆盖写", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-rewrite-"));
    const p = path.join(dir, "task-1-implement.json");
    writeFileSync(p, JSON.stringify({ task: 1, status: "DONE" }));
    rewriteHandoffBlocked(p, "boom");
    const h = JSON.parse(readFileSync(p, "utf8"));
    expect(h.status).toBe("BLOCKED");
    expect(h.blocker).toBe("boom");
    expect(h.artifacts).toEqual({});
  });

  it("无 path → no-op（去 path 守卫）", () => {
    expect(() => rewriteHandoffBlocked("", "boom")).not.toThrow();
    expect(() => rewriteHandoffBlocked(undefined as unknown as string, "boom")).not.toThrow();
  });
});