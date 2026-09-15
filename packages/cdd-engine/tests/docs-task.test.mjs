// packages/cdd-engine/tests/docs-task.test.mjs — Vitest port of the docs review/fix CLI tests, now
// exercised through the merged single CLI (bin/cdd.mjs). Invocation map (D11: type
// 自解释 target 参数):
//   docs-task --mode review --template <t>  → cdd review --type spec|plan [--spec/--plan <path>]
//   docs-task --mode fix --template <t>     → cdd fix --type spec|plan [--spec/--plan <path>]
// P6 T3: docs workspace 全走 resolveWorkspace(doc)（.osuperpowers/cdd/<slug>/）—— 测试须传
// repo 内 doc 供 workspace 推导；fix round 从 --findings 名解析（<type>-review-{R}.json）。
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { forkLifecyclePath } from './helpers.mjs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd.mjs');
const SMOKE_PLAN = path.join('packages/cdd-engine/tests/fixtures/smoke-plan.md');
// T10 warn: SMOKE_PLAN 派生 workspace = .osuperpowers/cdd/smoke/（engine workspaceSlug
// strip 尾 -plan：smoke-plan.md → smoke）——测试 teardown 清理，
// 避免 validate 后根杂讯污染 F6 单一根（与 branch-review/cdd.test 的 tmp/teardown 迁移同语义）。
afterAll(() => {
  rmSync(FINDINGS_DIR, { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, '.osuperpowers', 'cdd', 'smoke'), { recursive: true, force: true });
});

// 合法 findings 名（round 源）—— P4 T2 起 `--findings` 经 resolveDocArg 归一（仓根相对 → 绝对、
// **不存在 → exit 1 三行诊断**，read point ⑦），故 fixture 必须真实落盘。落点用独立 tmp 目录而非
// `.osuperpowers/cdd/smoke/`：后者是 SMOKE_PLAN 的 workspace，塞入 spec-review-1.json 会让 cdd.test.mjs
// 的同 slug 用例命中 Review Stopping（跨文件共享盘面）。round 只从**文件名**解析，位置无关。
const FINDINGS_DIR = mkdtempSync(path.join(tmpdir(), 'cdd-doctask-findings-'));
const SPEC_FINDINGS = path.join(FINDINGS_DIR, 'spec-review-1.json');
const PLAN_FINDINGS = path.join(FINDINGS_DIR, 'plan-review-1.json');
for (const f of [SPEC_FINDINGS, PLAN_FINDINGS]) {
  writeFileSync(f, JSON.stringify({ status: 'CHANGES_REQUESTED', findings: [] }));
}
// CDD_LIFECYCLE_PATH 注入在 P4 §2.4.1 后已 **inert**（bin 侧读取点已删）：lifecycle 恒落
// <repoRoot>/.osuperpowers/cdd/lifecycle.json，各 fork 共用；并发安全由 reapStale 的 owner 存活判定
// 承担，不依赖路径分离（spec §2.2 A / §2.6；详见 helpers.mjs forkLifecyclePath 注释）。注入保留至
// §2.4.4「测试缝删净」退场。
const LIFECYCLE_PATH = forkLifecyclePath("doctask");

function run(args, extraEnv = {}, opts = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  // T3: host detection is ambient-env driven — a no-host test must explicitly delete the
  // host markers (parent session may carry CLAUDE_CODE_SESSION_ID/AI_AGENT).
  if (opts.noHost) {
    delete env.CLAUDE_CODE_SESSION_ID;
    delete env.CURSOR_TRACE_ID;
    delete env.AI_AGENT;
  }
  return spawnSync('node', [CDD_MJS, ...args], {
    cwd: REPO_ROOT,
    env: { ...env, ...extraEnv, CDD_LIFECYCLE_PATH: LIFECYCLE_PATH },
    encoding: 'utf8',
  });
}

describe('cdd review/fix --type spec|plan CLI contract', () => {
  it('-h → Commander help on stdout + exit 0', () => {
    const r = run(['-h']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^Usage: cdd/);
  });

  it('no host env → CDD_BLOCKED + exit 1 (harness resolved from ambient host, no flag)', () => {
    const r = run(['review', '--type', 'spec', '--spec', '/x.md'], {}, { noHost: true });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no host harness detected|CDD_BLOCKED/);
  });

  it('missing --spec (type=spec target param) → stderr + exit 2', () => {
    const r = run(['review', '--type', 'spec'], { CLAUDE_CODE_SESSION_ID: '1' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/missing required --spec/);
  });

  it('dry-run review --type spec → exit 0', () => {
    const r = run(
      ['review', '--type', 'spec', '--spec', SMOKE_PLAN],
      { CDD_DRY_RUN: '1', CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });

  it('dry-run review --type plan → exit 0', () => {
    const r = run(
      ['review', '--type', 'plan', '--plan', SMOKE_PLAN],
      { CDD_DRY_RUN: '1', CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });

  it('dry-run fix --type spec → exit 0（T3: round 从 --findings spec-review-{R}.json 名解析）', () => {
    const r = run(
      ['fix', '--type', 'spec', '--spec', SMOKE_PLAN, '--findings', SPEC_FINDINGS],
      { CDD_DRY_RUN: '1', CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });

  it('dry-run fix --type plan → exit 0', () => {
    const r = run(
      ['fix', '--type', 'plan', '--plan', SMOKE_PLAN, '--findings', PLAN_FINDINGS],
      { CDD_DRY_RUN: '1', CLAUDE_CODE_SESSION_ID: '1' },
    );
    expect(r.status, r.stderr).toBe(0);
  });
});