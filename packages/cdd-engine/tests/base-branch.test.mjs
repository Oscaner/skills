// packages/cdd-engine/tests/base-branch.test.mjs
// `cdd base-branch set/get` CLI blackbox（P5 spec §2.3 / task-3 brief）。
// 唯一 seam = CLI 公共面（bin/cdd.mjs 薄入口 + base-branch 子命令）：双落点（CDD --plan /
// standalone --scope --slug）、schema/flag 校验、幂等 + --force、get JSON 往返、
// SUBCOMMAND_USAGE 单词键回退。模块层幂等矩阵由 workspace-artifacts.test.mjs（Task 2）覆盖，
// 此处只验证 CLI→模块接线 + CLI 自有的 flag 边界与报错面（exit 非零）。
// 每条用例用独立 tmp git repo（mkdtemp）隔离副作用；CDD_LIFECYCLE_PATH 每 fork 唯一，
// 避免 bin 启动 reapStale 并发误杀 + 保持 repo 内 .superpowers 仅为被测命令所写。
import { describe, it, expect, afterAll } from "vitest";
import { execaSync } from "execa";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { forkLifecyclePath } from "./helpers.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));   // packages/cdd-engine/tests
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const CDD_MJS = path.join(REPO_ROOT, "packages/cdd-engine/bin/cdd.mjs");
const NODE = process.execPath;
const LIFECYCLE_PATH = forkLifecyclePath("bb");

// 与 cdd.test.mjs 同构：剥离继承的 CDD_*，extendEnv:false 防 orchestrator 环境泄漏回 child。
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("CDD_")) env[k] = v;
  }
  return { ...env, ...extra, CDD_LIFECYCLE_PATH: LIFECYCLE_PATH };
}

function runCli(args, opts = {}) {
  const { cwd = REPO_ROOT } = opts;
  try {
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd, env: cleanEnv(), encoding: "utf8", extendEnv: false });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    return { exitCode: e.exitCode ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

// 临时 git 仓库（resolveWorkspace/gitToplevel 需要真实 repo root；workspaceSlug 由文件名派生）。
function tmpGitRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-bb-"));
  execaSync("git", ["-C", dir, "init", "-q"]);
  execaSync("git", ["-C", dir, "-c", "user.name=bb-test", "-c", "user.email=bb-test@example.com",
    "commit", "--allow-empty", "-qm", "fixture"]);
  return dir;
}

// 在 repo 内建 plan 文件（父目录一并创建：resolveWorkspace 从 dirname(doc) 走 gitToplevel）。
function seedPlan(repo) {
  const plan = path.join(repo, "plans", "app-plan.md");
  mkdirSync(path.dirname(plan), { recursive: true });
  writeFileSync(plan, "# app plan\n");   // workspaceSlug: app-plan → app
  return plan;
}

function cddWorkspace(repo) {
  return path.join(repo, ".superpowers", "cdd", "app");
}

function standaloneDir(repo, slug = "tool-x") {
  return path.join(repo, ".superpowers", "standalone", slug);
}

function readBaseBranch(dir) {
  return JSON.parse(readFileSync(path.join(dir, "base-branch.json"), "utf8"));
}

describe("cdd base-branch set — 双落点 + 幂等/force 矩阵", () => {
  it("set --plan CDD → base-branch.json 落于 resolveWorkspace(plan) + exit 0", () => {
    const repo = tmpGitRepo();
    try {
      const plan = seedPlan(repo);
      const r = runCli(["base-branch", "set", "--base", "develop", "--source", "plan-field", "--plan", plan], { cwd: repo });
      expect(r.exitCode).toBe(0);
      const saved = readBaseBranch(cddWorkspace(repo));
      expect(saved.base).toBe("develop");
      expect(saved.source).toBe("plan-field");
      expect(saved.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("set --scope standalone --slug → <gitRoot>/.superpowers/standalone/<slug>/base-branch.json", () => {
    const repo = tmpGitRepo();
    try {
      const r = runCli(["base-branch", "set", "--base", "develop", "--source", "user-confirmed",
        "--scope", "standalone", "--slug", "tool-x"], { cwd: repo });
      expect(r.exitCode).toBe(0);
      const saved = readBaseBranch(standaloneDir(repo));
      expect(saved.base).toBe("develop");
      expect(saved.source).toBe("user-confirmed");
      expect(saved.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("set 同 base → source 追新 / base+confirmed_at 保真（CLI→模块幂等接线）", () => {
    const repo = tmpGitRepo();
    try {
      const plan = seedPlan(repo);
      runCli(["base-branch", "set", "--base", "develop", "--source", "plan-field", "--plan", plan], { cwd: repo });
      const first = readBaseBranch(cddWorkspace(repo));
      const r = runCli(["base-branch", "set", "--base", "develop", "--source", "branch-upstream", "--plan", plan], { cwd: repo });
      expect(r.exitCode).toBe(0);
      const second = readBaseBranch(cddWorkspace(repo));
      expect(second.source).toBe("branch-upstream");
      expect(second.base).toBe("develop");
      expect(second.confirmed_at).toBe(first.confirmed_at);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("set 异 base 无 --force → 拒绝 + exit 非零 + 权威不变", () => {
    const repo = tmpGitRepo();
    try {
      const plan = seedPlan(repo);
      runCli(["base-branch", "set", "--base", "develop", "--source", "plan-field", "--plan", plan], { cwd: repo });
      const r = runCli(["base-branch", "set", "--base", "main", "--source", "user-confirmed", "--plan", plan], { cwd: repo });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/force/);
      expect(readBaseBranch(cddWorkspace(repo)).base).toBe("develop");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("set standalone --force → 覆盖成功（新 base）", () => {
    const repo = tmpGitRepo();
    try {
      runCli(["base-branch", "set", "--base", "develop", "--source", "plan-field",
        "--scope", "standalone", "--slug", "tool-x"], { cwd: repo });
      const r = runCli(["base-branch", "set", "--base", "main", "--source", "user-confirmed",
        "--scope", "standalone", "--slug", "tool-x", "--force"], { cwd: repo });
      expect(r.exitCode).toBe(0);
      expect(readBaseBranch(standaloneDir(repo)).base).toBe("main");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("cdd base-branch set — 校验失败面（exit 非零 + errors）", () => {
  it("非法 source → exit 非零 + stderr 含 source enum", () => {
    const repo = tmpGitRepo();
    try {
      const plan = seedPlan(repo);
      const r = runCli(["base-branch", "set", "--base", "develop", "--source", "bogus", "--plan", plan], { cwd: repo });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/source/);
      // 拒绝后不落盘坏 artifact
      expect(existsSync(path.join(cddWorkspace(repo), "base-branch.json"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("standalone 组缺 --base/--source → exit 非零 + 明确报错", () => {
    const repo = tmpGitRepo();
    try {
      const r = runCli(["base-branch", "set", "--scope", "standalone", "--slug", "tool-x"], { cwd: repo });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/--base/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("缺 target（CDD 无 plan / 无 scope）→ exit 非零 + 明确报错（CDD 需 --plan）", () => {
    const repo = tmpGitRepo();
    try {
      const r = runCli(["base-branch", "set", "--base", "develop", "--source", "plan-field"], { cwd: repo });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/--plan/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("flag 边界：--plan 与 --scope/--slug 并存 → 互斥 exit 2", () => {
    const repo = tmpGitRepo();
    try {
      const plan = seedPlan(repo);
      const r = runCli(["base-branch", "set", "--base", "x", "--source", "plan-field",
        "--plan", plan, "--scope", "standalone", "--slug", "s"], { cwd: repo });
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toMatch(/mutually exclusive/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("flag 边界：--scope 非 standalone → exit 2", () => {
    const repo = tmpGitRepo();
    try {
      const r = runCli(["base-branch", "set", "--base", "x", "--source", "plan-field",
        "--scope", "cdd", "--slug", "s"], { cwd: repo });
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toMatch(/standalone/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("cdd base-branch get — 双场景读 + 缺失/schema 非法", () => {
  it("get --plan CDD 读回 JSON 往返（base/source/confirmed_at 保持）", () => {
    const repo = tmpGitRepo();
    try {
      const plan = seedPlan(repo);
      runCli(["base-branch", "set", "--base", "develop", "--source", "plan-field", "--plan", plan], { cwd: repo });
      const r = runCli(["base-branch", "get", "--plan", plan], { cwd: repo });
      expect(r.exitCode).toBe(0);
      const got = JSON.parse(r.stdout);
      expect(got.base).toBe("develop");
      expect(got.source).toBe("plan-field");
      expect(got.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // JSON 往返：get 输出 ≡ 盘上 artifact
      expect(got).toEqual(readBaseBranch(cddWorkspace(repo)));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("get --scope standalone --slug 读回 JSON 往返", () => {
    const repo = tmpGitRepo();
    try {
      runCli(["base-branch", "set", "--base", "develop", "--source", "user-confirmed",
        "--scope", "standalone", "--slug", "tool-x"], { cwd: repo });
      const r = runCli(["base-branch", "get", "--scope", "standalone", "--slug", "tool-x"], { cwd: repo });
      expect(r.exitCode).toBe(0);
      const got = JSON.parse(r.stdout);
      expect(got.base).toBe("develop");
      expect(got.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("get 无 target → exit 非零 + 明确报错", () => {
    const repo = tmpGitRepo();
    try {
      const r = runCli(["base-branch", "get"], { cwd: repo });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/--plan/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("get 目标缺失（base-branch.json 不存在）→ exit 非零 + 明确报『artifact 缺失』", () => {
    const repo = tmpGitRepo();
    try {
      const plan = seedPlan(repo);        // plan 存在，但从未 set → 无 artifact
      const r = runCli(["base-branch", "get", "--plan", plan], { cwd: repo });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/base-branch/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("get schema 非法 → exit 非零 + errors（存量坏 artifact 不静默放过）", () => {
    const repo = tmpGitRepo();
    try {
      const plan = seedPlan(repo);
      mkdirSync(cddWorkspace(repo), { recursive: true });
      writeFileSync(path.join(cddWorkspace(repo), "base-branch.json"),
        JSON.stringify({ base: "develop", source: "bogus", confirmed_at: "2026-09-12T10:00:00.000Z" }));
      const r = runCli(["base-branch", "get", "--plan", plan], { cwd: repo });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/source/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("cdd base-branch — 命令面（SUBCOMMAND_USAGE + help 标题）", () => {
  it("坏 flag 落 base-branch 单词键 usage 行（usageError 只读 argv[2]）", () => {
    const repo = tmpGitRepo();
    try {
      const r = runCli(["base-branch", "get", "--bogus"], { cwd: repo });
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toMatch(/usage: cdd base-branch <set\|get>/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("未知子命令 → 同样回退 base-branch usage 行", () => {
    const repo = tmpGitRepo();
    try {
      const r = runCli(["base-branch", "bogus-xyz"], { cwd: repo });
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toMatch(/usage: cdd base-branch <set\|get>/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("cdd --help 标题含 base-branch", () => {
    const r = runCli(["--help"], { cwd: REPO_ROOT });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/base-branch/);
  });

  it("cdd base-branch --help → 列 set/get + exit 0", () => {
    const r = runCli(["base-branch", "--help"], { cwd: REPO_ROOT });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/set/);
    expect(r.stdout).toMatch(/get/);
  });
});

// 清理：本文件所有 set 落点都在 tmp repo 内，无 repo-root 副作用 —— 仅兜底清理（无实际残留）。
afterAll(() => {
  rmSync(path.join(REPO_ROOT, ".superpowers", "cdd", "app"), { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, ".superpowers", "standalone"), { recursive: true, force: true });
});
