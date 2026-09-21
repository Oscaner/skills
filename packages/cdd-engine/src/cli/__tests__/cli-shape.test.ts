// packages/cdd-engine/src/cli/__tests__/cli-shape.test.ts
//（src/cli/parse.ts 的唯一命令面）的 review/fix option 形态（--doc 退役 → type
// 自解释 --spec/--plan）+ 新形态 dry-run smoke。
// P3 命令面收敛守卫：退役命令（`cdd research` / `cdd brief`）黑盒完整形态 exit 2、
// citty mainCommand.subCommands 顶层命令集合恰为四、命令声明面零回渗
//（无 subCommands.brief / subCommands.research）。
// 用静态断言读声明树而非 CLI 级旧形态运行 —— 旧 `--doc` 现被 flag 面守卫（guardArgs）拒绝
//（exit 2），且新形态若未落地则 silent-accept 后触发真实 dispatch（副作用）。env 注入
// CLAUDE_CODE_SESSION_ID="1" 判 host（否则 BLOCK），program 级 argv 前置 `--dry-run` 短路真实
// harness 调用。
// **5b CLI 黑盒用例依赖「入口门意义下的干净树」（E2②/G4①，P6 T10）**：本文件 dry-run smoke 以
// cwd=REPO_ROOT 黑盒运行，入口门（rules/commit.ts entryGateCleanTree）放行依赖两态之一——真实
// 干净树，或 dirty + dry-run 的 CDD_WARN 降级（exit 0，纯模拟）。本文件的期望按「脏树也不 BLOCK」
// 编写（E2② 文档化前置）：入口门/dry-run 协议语义变更需同步维护此处（详见 vitest.config.mjs 5b）。
import { describe, it, expect, afterAll } from 'vitest';
import { execaSync } from 'execa';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mainCommand } from '../parse.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url)); 
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/dist/cli.mjs');
// 薄入口化（spec §2.3）：命令定义（option 形态）已移 src/cli/parse.ts —— 静态断言改读 citty
// 声明（mainCommand.subCommands.*.args）；CLI 黑盒 exec 入口仍 CDD_MJS（dist/cli.mjs 由
// src/bin.ts 构建，行为不变）。
const SMOKE_PLAN = path.join('packages/cdd-engine/src/cli/__tests__/fixtures/smoke-plan.md');
// SMOKE_SPEC 用 fixtures 自有 smoke-spec.md —— 不能用本 repo 真实 spec 路径（如 design.md）：
// 真实 spec 已被 spec-review 轮次评过（APPROVED + blocker=0），会在 Review Convergence 守卫处
// exit 3（round 递增 + prev.doc_path 匹配），使 new-shape smoke 因 Convergence 而非形态错误失败。
const SMOKE_SPEC = path.join('packages/cdd-engine/src/cli/__tests__/fixtures/smoke-spec.md');
const NODE = process.execPath;

// SMOKE_PLAN/SMOKE_SPEC derive workspace = .osuperpowers/cdd/smoke/{smoke-spec}/ (T10 warn) —
  // (engine workspaceSlug strips a trailing -plan: smoke-plan.md → smoke)
// Smoke-case teardown cleanup (dry-run writes nothing to disk, so it is a defensive fallback).
// Only smoke-spec is cleaned (its slug is exclusive to this file): smoke/ is shared by cdd /
// docs-task / host-detection / lifecycle.wiring under the same slug, so deleting it races those
// files' brief self-supply (mkdirSync → generateBrief write gap → ENOENT false red).
afterAll(() => {
  rmSync(path.join(REPO_ROOT, '.osuperpowers', 'cdd', 'smoke-spec'), { recursive: true, force: true });
});

// runCli: spawnSync-style { exitCode, stdout, stderr }，与 cdd.test.mjs 同构（execaSync +
// 剥离 CDD_* 继承 env + extendEnv:false，避免 orchestrator 携带的 CDD_* 泄漏回 child）。
function runCli(args, { env: extraEnv = {} } = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  try {
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd: REPO_ROOT, env: { ...env, ...extraEnv }, encoding: 'utf8', extendEnv: false });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  } catch (e) {
    return { exitCode: e.exitCode ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

const HOST_ENV = { CLAUDE_CODE_SESSION_ID: '1' };

describe('cdd review/fix option 形态（D11: --doc 退役 → --spec/--plan type 自解释）', () => {
  it('review 声明面无 doc arg（D11 退役）；spec/plan arg 存在', () => {
    const reviewArgs = mainCommand.subCommands.review.args;
    expect(reviewArgs).not.toHaveProperty('doc');
    expect(reviewArgs).toHaveProperty('spec');
    expect(reviewArgs).toHaveProperty('plan');
  });

  it('fix 声明面无 doc arg（D11 退役）；plan arg 存在', () => {
    const fixArgs = mainCommand.subCommands.fix.args;
    expect(fixArgs).not.toHaveProperty('doc');
    expect(fixArgs).toHaveProperty('plan');
  });

  // 新形态 smoke（argv 前置 `--dry-run` 防真实 dispatch；SMOKE_SPEC/SMOKE_PLAN 仅作参数存在性，dry-run 不读内容）:
  it('review --type spec --spec 形态 dry-run 可过（new shape）', () => {
    const r = runCli(['--dry-run', 'review', '--type', 'spec', '--spec', SMOKE_SPEC, '--plan', SMOKE_PLAN],
      { env: { ...HOST_ENV } });
    expect(r.exitCode).toBe(0);
  });

  it('review --type plan --plan 形态 dry-run 可过（new shape）', () => {
    const r = runCli(['--dry-run', 'review', '--type', 'plan', '--plan', SMOKE_PLAN],
      { env: { ...HOST_ENV } });
    expect(r.exitCode).toBe(0);
  });

  it('review 传已被删除的 --doc → unknown option exit 2（旧形态退役）', () => {
    const r = runCli(['--dry-run', 'review', '--type', 'spec', '--doc', SMOKE_PLAN],
      { env: { ...HOST_ENV } });
    expect(r.exitCode).toBe(2);
  });

  // Retired subcommands (P3): the full call shape is asserted because the bare shape also exited 2
  // before removal (Commander's missing required-option) — a false green.
  it('cdd research（完整形态）→ unknown command exit 2（子命令退役）', () => {
    const r = runCli(['--dry-run', 'research', '--brief', SMOKE_PLAN, '--output', '/tmp/p3-retired-research.md'],
      { env: { ...HOST_ENV } });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/usage: cdd/);
  });

  // The brief subcommand is fully removed from both the command surface and the CLI handler (P3 T2);
  // like research, the full call shape is exercised (the bare shape also exited 2 before removal —
  // Commander's missing required-option — a false green).
  it('cdd brief（完整形态）→ unknown command exit 2（子命令退役）', () => {
    const r = runCli(['brief', '--task', '1', '--plan', SMOKE_PLAN, '--output', '/tmp/p3-retired-brief.md']);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/usage: cdd/);
  });
});

// The command surface converges on the canonical set (implement / review / fix / base-branch) plus
// the P2 carve-out `help` (overall v1.10 Non-goal#1 — `cdd help` is the engine's ONE legitimate new
// subcommand, discovery-only, zero enforcement logic; P2 T1).
// Static instance assertions beat text regexes — citty's subCommands only holds **direct**
// subcommands, so nested base-branch.set / .get stay out of the set (parse.mjs's header states
// "this file is statically readable by tests (cli-shape); import has no side effects";
// runCommand fires from the bin thin entry).
describe('P3 命令面收敛（P2 carve-out: help）:顶层子命令恰为五', () => {
  it('mainCommand.subCommands 名称集合 === {base-branch, fix, help, implement, review}', () => {
    expect(Object.keys(mainCommand.subCommands).sort()).toEqual(
      ['base-branch', 'fix', 'help', 'implement', 'review'],
    );
  });

  it('声明面无 brief / research 子命令注册', () => {
    expect(mainCommand.subCommands).not.toHaveProperty('brief');
    expect(mainCommand.subCommands).not.toHaveProperty('research');
  });
});

// guardArgs' --no-<bool> negation is boolean-only — negating a string/enum arg (--no-plan)
// is an unknown-option rejection (exit 2), not a silent accept (T9 fix).
describe('guardArgs: --no-* negation restricted to boolean args', () => {
  it('base-branch get --no-plan → unknown option exit 2 (negating a string arg is rejected)', () => {
    const r = runCli(['base-branch', 'get', '--no-plan', SMOKE_PLAN]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/unknown option: --no-plan/);
  });

  it('base-branch set --no-force passes the guard (boolean negation still accepted)', () => {
    const r = runCli(['base-branch', 'set', '--plan', SMOKE_PLAN, '--no-force']);
    // Guard accepts --no-force; runBaseBranchSet then fails on the missing --base group —
    // the error must NOT be "unknown option".
    expect(r.stderr).not.toMatch(/unknown option/);
  });
});
