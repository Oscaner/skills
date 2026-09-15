// packages/cdd-engine/tests/branch-review.test.mjs
// Branch-review dry-run through the merged single CLI (harness resolved from the ambient host):
//   (legacy standalone branch-review bin: -h <name> flag) --plan <p> --base <b> --head <h>
//   → cdd review --type branch --plan <p> --base <b> --head <h> + CLAUDE_CODE_SESSION_ID=1 env
// T10 warn: fixture plan/workspace 用临时 git 仓库（临时目录），不写真实 repo 的 .osuperpowers/cdd/ ——
// 避免 validate 轮次污染 F6 单一根（smoke-plan/test-plan-br 再生）。
// P4 T2 单一坐标系：branch review 的 workspace 由**注入 root**（= cwd 的 git toplevel，bin preAction
// 经 initRoot 初始化）派生，不再由 plan 路径形状反推 —— 故调用必须 `cwd: dir` 让 root 落在本 tmp 仓，
// 否则产物落到 vitest 进程 cwd 所在的仓根（旧 doc-path 派生行为已删）。
import { describe, it, expect } from 'vitest';
import { execaSync } from 'execa';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { forkLifecyclePath } from './helpers.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..'); // tests → packages/cdd-engine → packages → repo
// CDD_LIFECYCLE_PATH 注入在 P4 §2.4.1 后已 **inert**（bin 侧读取点已删）：lifecycle 恒落
// <repoRoot>/.osuperpowers/cdd/lifecycle.json，各 fork 共用；并发安全由 reapStale 的 owner 存活判定
// 承担，不依赖路径分离（spec §2.2 A / §2.6；详见 helpers.mjs forkLifecyclePath 注释）。注入保留至
// §2.4.4「测试缝删净」退场。
const LIFECYCLE_PATH = forkLifecyclePath("branch");

function tmpGitRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'cdd-br-'));
  execaSync('git', ['-C', dir, 'init', '-q']);
  execaSync('git', ['-C', dir, '-c', 'user.name=cdd-test', '-c', 'user.email=cdd-test@example.com',
    'commit', '--allow-empty', '-qm', 'fixture']);
  return dir;
}

describe('branch-review dry-run', () => {
  it('writes CDD handoff to .osuperpowers/cdd/<slug>/ with CDD schema fields', () => {
    const dir = tmpGitRepo();
    const slug = 'test-plan-br';
    const planPath = path.join(dir, 'test-plan-br.md');
    const handoffPath = path.join(dir, '.osuperpowers', 'cdd', slug,
                                  'branch-review-abc1234..def5678-r1.json');

    writeFileSync(planPath, '# Test branch review plan\n\n### Task 1: n/a (branch-level smoke)\n');

    try {
      const out = execaSync('node', [
        path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd.mjs'),
        'review', '--type', 'branch',
        '--plan', planPath,
        '--base', 'abc1234',
        '--head', 'def5678',
      ], { cwd: dir, env: { ...process.env, CDD_DRY_RUN: '1', CLAUDE_CODE_SESSION_ID: '1', CDD_LIFECYCLE_PATH: LIFECYCLE_PATH }, encoding: 'utf8' }).stdout;

      expect(out).toContain('status: APPROVED');
      expect(out).toContain('commits: base=abc1234 head=def5678');
      expect(existsSync(handoffPath)).toBe(true);

      const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(handoff).toHaveProperty('status');
      expect(handoff).toHaveProperty('commits');
      expect(handoff.commits).toHaveProperty('base', 'abc1234');
      expect(handoff.commits).toHaveProperty('head', 'def5678');
      expect(handoff).toHaveProperty('findings');
      expect(handoff).toHaveProperty('blocker');
      expect(handoff).not.toHaveProperty('doc_path');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});