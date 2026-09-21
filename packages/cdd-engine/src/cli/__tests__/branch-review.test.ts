// packages/cdd-engine/src/cli/__tests__/branch-review.test.ts
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
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeBranchChain } from '../../infra/__tests__/helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..'); // tests → packages/cdd-engine → packages → repo

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
    const planPath = writeBranchChain(dir, 'test-plan-br.md');
    const handoffPath = path.join(dir, '.osuperpowers', 'cdd', slug,
                                  'branch-review-abc1234..def5678-r1.json');

    try {
      const out = execaSync('node', [
        path.join(REPO_ROOT, 'packages/cdd-engine/dist/cli.mjs'),
        '--dry-run', 'review', '--type', 'branch',
        '--plan', planPath,
        '--base', 'abc1234',
        '--head', 'def5678',
      ], { cwd: dir, env: { ...process.env, CLAUDE_CODE_SESSION_ID: '1' }, encoding: 'utf8' }).stdout;

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

// ---- review-3 finding 4（standards nit）+ finding 1（warn）：branch 路 schema-invalid 分支端到端 ----
// 此前 branch-review.test.mjs 只有 dry-run 冒烟（subprocess 早退于 dry-run 分支）→ writeBranchBlocked
// 的载荷组装只靠共享单元单测间接担保。此处仿 runner.test.mjs 的 8.8 归一化不可救用例：ghost registry +
// fake-cli 真写违规 handoff → runBranchReview 进程内实跑（registryPath 测试缝注入 ghost registry）→
// 断言 BLOCKED 载体键集干净（engine 字面量，不 spread 归一化结果）、findings 守卫成 []、blocker 含违规键名。
describe('branch-review schema-invalid e2e', () => {
  it('agent 写 findings 非数组 + notes:5 → BLOCKED 载体键集干净 / findings [] / blocker 含违规键名', async () => {
    const dir = tmpGitRepo();
    const slug = 'test-plan-br';
    const planPath = writeBranchChain(dir, `${slug}.md`);
    const base = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    // 与 runBranchReview 同派生的 handoff 路径（全新 workspace → round 1）
    const { resolveWorkspace, handoffName, resolveNextRound } = await import('../../artifacts/handoff/naming.ts');
    const workspace = resolveWorkspace(planPath, dir);
    const round = resolveNextRound(workspace, 'review', 'branch', { base7, head7 });
    const handoffPath = path.join(workspace, handoffName('review', 'branch', { base7, head7, round }));
    // fake-cli：应引擎调用写出违规 handoff 后 exit 0（真实子进程，与 runner.test.mjs 的 fake-cli 同法）
    const binDir = mkdtempSync(path.join(tmpdir(), 'cdd-br-sv-'));
    writeFileSync(path.join(binDir, 'fake-cli'),
      `#!/usr/bin/env bash\n` +
      `printf '%s' '{"task":1,"phase":"branch-review","status":"APPROVED","commits":{"base":"${base}"},"findings":"none","notes":5,"artifacts":{}}' > "${handoffPath}"\n` +
      `exit 0\n`);
    chmodSync(path.join(binDir, 'fake-cli'), 0o755);
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    // ghost registry：真实 harness-registry.json + 追加 fake-cli（runBranchReview 经 opts.registryPath 注入）
    const { REG_PATH } = await import('../../infra/registry.ts');
    const regPath = path.join(dir, 'registry.json');
    const reg = JSON.parse(readFileSync(REG_PATH, 'utf8'));
    reg.ghost = { cli: 'fake-cli', invoke: '-p', output: 'text', ship: 'full' };
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    try {
      const { ExitRequested } = await import('../../infra/exit.ts');
      const { runBranchReview } = await import('../branch-review.ts');
      let exitCode = null;
      try {
        await runBranchReview({ harness: 'ghost', plan: planPath, base, head, root: dir, registryPath: regPath });
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      expect(exitCode).toBe(1);
      const h = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(h.status).toBe('BLOCKED');
      expect(h.phase).toBe('branch-review');
      // 键集干净：engine 字面量 + commits/findings（agent 的 notes / findings:"none" 不得进载体）
      expect(Object.keys(h).sort())
        .toEqual(['artifacts', 'blocker', 'commits', 'findings', 'phase', 'status', 'task']);
      expect(h.findings).toEqual([]);          // 非数组 findings → 数组守卫成 []
      expect(h.commits.base).toBe(base);       // branch 的 base/head 是引擎真值（AC15 文件名承载 short 形）
      expect(h.commits.head).toBe(head);
      expect(h).not.toHaveProperty('notes');
      expect(h.blocker).toMatch(/notes/);      // 违规键名（ajv /notes must be string）在 blocker 文案
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- S-2 hardening (branch-review warn): unguarded JSON.parse degradation ----
// The unparseable-lane / corrupt-prev e2e cases pin the T8 hardening parity: an agent-written
// handoff that is not valid JSON must land a BLOCKED carrier (not a bare SyntaxError → exit 2
// with the corrupt file left on disk), and a corrupt previous-round handoff must fail open
// (CDD_INFO + no Convergence lock), not crash the review.
describe('branch-review unparseable-handoff e2e', () => {
  async function runBranchReviewWithFakeCli(opts: { handoffBody: string }, deps: { dir: string; planPath: string; base: string; head: string; handoffPath: string; regPath: string }) {
    const { dir, planPath, base, head, handoffPath, regPath } = deps;
    const binDir = mkdtempSync(path.join(tmpdir(), 'cdd-br-up-'));
    writeFileSync(path.join(binDir, 'fake-cli'),
      `#!/usr/bin/env bash\n` +
      `printf '%s' '${opts.handoffBody}' > "${handoffPath}"\n` +
      `exit 0\n`);
    chmodSync(path.join(binDir, 'fake-cli'), 0o755);
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    try {
      const { ExitRequested } = await import('../../infra/exit.ts');
      const { runBranchReview } = await import('../branch-review.ts');
      let exitCode: number | null = null;
      try {
        await runBranchReview({ harness: 'ghost', plan: planPath, base, head, root: dir, registryPath: regPath });
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      return exitCode;
    } finally {
      process.env.PATH = origPath;
    }
  }

  async function ghostRegistry(dir: string): Promise<string> {
    const { REG_PATH: REG } = await import('../../infra/registry.ts');
    const reg = JSON.parse(readFileSync(REG, 'utf8'));
    reg.ghost = { cli: 'fake-cli', invoke: '-p', output: 'text', ship: 'full' };
    const regPath = path.join(dir, 'registry.json');
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    return regPath;
  }

  it('agent writes unparseable handoff → BLOCKED carrier + exit 1 (no bare SyntaxError)', async () => {
    const dir = tmpGitRepo();
    const slug = 'test-plan-br';
    const planPath = writeBranchChain(dir, `${slug}.md`);
    const base = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    const { resolveWorkspace, handoffName, resolveNextRound } = await import('../../artifacts/handoff/naming.ts');
    const workspace = resolveWorkspace(planPath, dir);
    const round = resolveNextRound(workspace, 'review', 'branch', { base7: base.slice(0, 7), head7: head.slice(0, 7) });
    const handoffPath = path.join(workspace, handoffName('review', 'branch', { base7: base.slice(0, 7), head7: head.slice(0, 7), round }));
    const regPath = await ghostRegistry(dir);
    try {
      const exitCode = await runBranchReviewWithFakeCli(
        { handoffBody: '{"task":1,"phase":"branch-review","status":"APPROVED"}' + ' <<\nbad json' },
        { dir, planPath, base, head, handoffPath, regPath },
      );
      expect(exitCode).toBe(1);
      const h = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(h.status).toBe('BLOCKED');
      expect(h.phase).toBe('branch-review');
      expect(h.blocker).toMatch(/handoff JSON unparseable/);
      // clean carrier keyset: engine literals only (the corrupt bytes never re-enter via merge)
      expect(Object.keys(h).sort())
        .toEqual(['artifacts', 'blocker', 'commits', 'findings', 'phase', 'status', 'task']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('corrupt previous-round handoff fails open (CDD_INFO, no Convergence lock), next round proceeds', async () => {
    const dir = tmpGitRepo();
    const slug = 'test-plan-br';
    const planPath = writeBranchChain(dir, `${slug}.md`);
    const base = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    const { resolveWorkspace, handoffName } = await import('../../artifacts/handoff/naming.ts');
    const workspace = resolveWorkspace(planPath, dir);
    // Pre-seed workspace with a CORRUPT r1 review (same ref) → the review must start at round 2
    // and not crash on the unparseable prev (fail-open → no Convergence lock).
    mkdirSync(workspace, { recursive: true });
    writeFileSync(path.join(workspace, handoffName('review', 'branch', { base7, head7, round: 1 })), '{\nnot json\n');
    const handoffPath = path.join(workspace, handoffName('review', 'branch', { base7, head7, round: 2 }));
    const regPath = await ghostRegistry(dir);
    const stderrWrite = process.stderr.write;
    const writes: string[] = [];
    process.stderr.write = (chunk: unknown, ...a: unknown[]) => {
      writes.push(String(chunk));
      return true;
    };
    try {
      const exitCode = await runBranchReviewWithFakeCli(
        { handoffBody: '{"task":1,"phase":"branch-review","status":"APPROVED","commits":{"base":"' + base + '","head":"' + head + '"},"findings":[],"artifacts":{}}' },
        { dir, planPath, base, head, handoffPath, regPath },
      );
      expect(exitCode).toBe(0);
      expect(existsSync(handoffPath)).toBe(true);
      expect(JSON.parse(readFileSync(handoffPath, 'utf8')).status).toBe('APPROVED');
      expect(writes.some((w) => w.includes('CDD_INFO') && w.includes('corrupt prev'))).toBe(true);
    } finally {
      process.stderr.write = stderrWrite;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
