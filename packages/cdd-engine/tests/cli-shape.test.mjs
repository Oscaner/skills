// tests/cli-shape.test.mjs — D11 CLI-surface shape test. 静态断言 command 定义面
//（lib/cli/parse.mjs，薄入口后命令定义唯一落点）的 review/fix option 形态（--doc 退役 →
// type 自解释 --spec/--plan）+ 新形态 dry-run smoke。
// 用静态断言而非 CLI 级旧形态运行 —— 旧 `--doc` 现为 unknown option（exit 2），且新形态若
// 未落地则 silent-accept 后触发真实 dispatch（副作用）。env 注入 CLAUDE_CODE_SESSION_ID="1"
// 判 host（否则 BLOCK），CDD_DRY_RUN="1" 短路真实 harness 调用。
import { describe, it, expect, afterAll } from 'vitest';
import { execaSync } from 'execa';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd.mjs');
// 薄入口化（spec §2.3）：命令定义（option 形态）已移 lib/cli/parse.mjs —— 静态断言改读 parse.mjs；
// CLI 黑盒 exec 入口仍 CDD_MJS（bin/cdd.mjs 薄入口拆包后行为不变）。
const PARSE_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/lib/cli/parse.mjs');
const SMOKE_PLAN = path.join('packages/cdd-engine/tests/fixtures/smoke-plan.md');
// SMOKE_SPEC 用 fixtures 自有 smoke-spec.md —— 不能用本 repo 真实 spec 路径（如 design.md）：
// 真实 spec 已被 spec-review 轮次评过（APPROVED + blocker=0），会在 Review Stopping 守卫处
// exit 3（round 递增 + prev.doc_path 匹配），使 new-shape smoke 因 Stopping 而非形态错误失败。
const SMOKE_SPEC = path.join('packages/cdd-engine/tests/fixtures/smoke-spec.md');
const NODE = process.execPath;
// Task 3 全派生接线后 fork 隔离：bin/cdd.mjs 启动经 initProcLifecycle + reapStale 读写
// CDD_LIFECYCLE_PATH（默认 <cwd>/.superpowers/cdd/lifecycle.json）。vitest pool:'forks' 并发
// fork 若共用该文件，任一 fork 启动 reapStale 读到另一 fork 刚落盘的 in-flight 组（ownerPid ≠
// 本 cdd）会按 orphan 连根误杀 → 每 fork 注入唯一 tmp 路径（process.pid 随 fork 唯一）（spec §2.2 A / §2.6）。
const LIFECYCLE_PATH = path.join(os.tmpdir(), `cdd-lifecycle-clishape-${process.pid}.json`);

// T10 warn: SMOKE_PLAN/SMOKE_SPEC 派生 workspace = .superpowers/cdd/smoke-plan/{smoke-spec}/ ——
// smoke 用例 teardown 清理（dry-run 不写盘，防御性清理兜底）。
afterAll(() => {
  rmSync(path.join(REPO_ROOT, '.superpowers', 'cdd', 'smoke-plan'), { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, '.superpowers', 'cdd', 'smoke-spec'), { recursive: true, force: true });
});

// runCli: spawnSync-style { exitCode, stdout, stderr }，与 cdd.test.mjs 同构（execaSync +
// 剥离 CDD_* 继承 env + extendEnv:false，避免 orchestrator 携带的 CDD_* 泄漏回 child）。
function runCli(args, { env: extraEnv = {} } = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  try {
    const r = execaSync(NODE, [CDD_MJS, ...args], { cwd: REPO_ROOT, env: { ...env, ...extraEnv, CDD_LIFECYCLE_PATH: LIFECYCLE_PATH }, encoding: 'utf8', extendEnv: false });
    return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  } catch (e) {
    return { exitCode: e.exitCode ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

const HOST_ENV = { CLAUDE_CODE_SESSION_ID: '1' };

describe('cdd review/fix option 形态（D11: --doc 退役 → --spec/--plan type 自解释）', () => {
  it('review 无 --doc option（D11 退役）；--spec/--plan option 存在', () => {
    const src = readFileSync(PARSE_MJS, 'utf8');
    expect(src).not.toMatch(/\.option\("--doc <path>"/);
    expect(src).toMatch(/\.option\("--spec <path>"/);
    expect(src).toMatch(/\.option\("--plan <path>"/);
  });

  it('fix 无 --doc option（D11 退役）；--plan option 存在', () => {
    const src = readFileSync(PARSE_MJS, 'utf8');
    expect(src).not.toMatch(/\.option\("--doc <path>"/);
    expect(src).toMatch(/\.option\("--plan <path>"/);
  });

  // 新形态 smoke（dry-run 防真实 dispatch；SMOKE_SPEC/SMOKE_PLAN 仅作参数存在性，dry-run 不读内容）:
  it('review --type spec --spec 形态 dry-run 可过（new shape）', () => {
    const r = runCli(['review', '--type', 'spec', '--spec', SMOKE_SPEC, '--plan', SMOKE_PLAN],
      { env: { ...HOST_ENV, CDD_DRY_RUN: '1' } });
    expect(r.exitCode).toBe(0);
  });

  it('review --type plan --plan 形态 dry-run 可过（new shape）', () => {
    const r = runCli(['review', '--type', 'plan', '--plan', SMOKE_PLAN],
      { env: { ...HOST_ENV, CDD_DRY_RUN: '1' } });
    expect(r.exitCode).toBe(0);
  });

  it('review 传已被删除的 --doc → unknown option exit 2（旧形态退役）', () => {
    const r = runCli(['review', '--type', 'spec', '--doc', SMOKE_PLAN],
      { env: { ...HOST_ENV, CDD_DRY_RUN: '1' } });
    expect(r.exitCode).toBe(2);
  });
});
