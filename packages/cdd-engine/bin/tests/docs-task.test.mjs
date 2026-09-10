// bin/tests/docs-task.test.mjs — Vitest port of the docs review/fix CLI tests, now
// exercised through the merged single CLI (bin/cdd.mjs). Invocation map (D11: type
// 自解释 target 参数):
//   docs-task --mode review --template <t>  → cdd review --type spec|plan [--spec/--plan <path>]
//   docs-task --mode fix --template <t>     → cdd fix --type spec|plan [--spec/--plan <path>]
// P6 T3: docs workspace 全走 resolveWorkspace(doc)（.superpowers/cdd/<slug>/）—— 测试须传
// repo 内 doc 供 workspace 推导；fix round 从 --findings 名解析（<type>-review-{R}.json）。
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/bin/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const CDD_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd.mjs');
const SMOKE_PLAN = path.join('packages', 'cdd-engine', 'bin', 'tests', 'fixtures', 'smoke-plan.md');
// T10 warn: SMOKE_PLAN 派生 workspace = .superpowers/cdd/smoke-plan/——测试 teardown 清理，
// 避免 validate 后根杂讯污染 F6 单一根（与 branch-review/cdd.test 的 tmp/teardown 迁移同语义）。
afterAll(() => {
  rmSync(path.join(REPO_ROOT, '.superpowers', 'cdd', 'smoke-plan'), { recursive: true, force: true });
});

// 合法 findings 名（round 源）—— 路径无需真实存在，docs 通道不接 dirty/存在性断言。
const SPEC_FINDINGS = path.join(REPO_ROOT, '.superpowers', 'cdd', 'smoke-plan', 'spec-review-1.json');
const PLAN_FINDINGS = path.join(REPO_ROOT, '.superpowers', 'cdd', 'smoke-plan', 'plan-review-1.json');

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
    env: { ...env, ...extraEnv },
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