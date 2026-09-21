// packages/cdd-engine/src/cli/__tests__/branch-fix.test.ts
// Task 9 (spec E2①): `cdd fix --type branch` — the branch-level review→fix loop's fix channel.
//   ① dry-run through the merged single CLI → APPROVED stub branch-fix-{base7}..{head7}-r{R}.json + return block;
//   ② usage guards: missing --plan / missing --findings / non-matching findings name → exit 2;
//   ③ in-process loop closure: a source review handoff (branch-review-{base7}..{head7}-r1.json) →
//      runBranchFix with a ghost fake-cli (writes the fix handoff + an empty fix commit) → the fix
//      writes branch-fix-{base7}..{head7}-r1.json with commits.base = the review's base (the fix's
//      FIX_BASE) and passes the exit gate; the fix commit moves HEAD → the next branch-review reads a
//      NEW ref → resolveNextRound returns round 1 (ref-moved = legal re-review — the Convergence law).
// T10 warn (mirrors branch-review.test.ts): fixture plan/workspace in a tmp git repo — never the
// real repo's .osuperpowers/cdd/.
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
  const dir = mkdtempSync(path.join(tmpdir(), 'cdd-bf-'));
  execaSync('git', ['-C', dir, 'init', '-q']);
  execaSync('git', ['-C', dir, '-c', 'user.name=cdd-test', '-c', 'user.email=cdd-test@example.com',
    'commit', '--allow-empty', '-qm', 'fixture']);
  return dir;
}

const FULL_ID = (c: string) => c.repeat(40);

// ---- ① dry-run (merged single CLI, host harness from the ambient env) ----
describe('branch-fix dry-run', () => {
  it('writes APPROVED branch-fix handoff + the 5-line return block block', () => {
    const dir = tmpGitRepo();
    const slug = 'test-plan-bf';
    const planPath = writeBranchChain(dir, `${slug}.md`);
    const findingsPath = path.join(dir, '.osuperpowers', 'cdd', slug,
      'branch-review-abc1234..def5678-r1.json');
    const handoffPath = path.join(dir, '.osuperpowers', 'cdd', slug,
      'branch-fix-abc1234..def5678-r1.json');

    try {
      const out = execaSync('node', [
        path.join(REPO_ROOT, 'packages/cdd-engine/dist/cli.mjs'),
        '--dry-run', 'fix', '--type', 'branch',
        '--plan', planPath,
        '--findings', findingsPath,
      ], { cwd: dir, env: { ...process.env, CLAUDE_CODE_SESSION_ID: '1' }, encoding: 'utf8' }).stdout;

      expect(out).toContain('status: APPROVED');
      expect(out).toContain('commits: base=dry-run head=dry-run');
      expect(out).toContain('blocker: dry-run');
      expect(existsSync(handoffPath)).toBe(true);

      const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(handoff).toHaveProperty('status', 'APPROVED');
      expect(handoff).toHaveProperty('phase', 'fix');
      expect(handoff).toHaveProperty('commits');
      expect(handoff).toHaveProperty('findings');
      expect(handoff).toHaveProperty('blocker');
      expect(handoff).not.toHaveProperty('doc_path');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ② usage guards (exit 2) ----
describe('branch-fix usage guards', () => {
  const runCli = (args: string[]) => {
    const dir = tmpGitRepo();
    const planPath = writeBranchChain(dir, 'test-plan-guard.md');
    const findingsPath = path.join(dir, '.osuperpowers', 'cdd', 'test-plan-guard',
      'branch-review-abc1234..def5678-r1.json');
    let r: { exitCode: number; stderr: string; stdout: string } | null = null;
    try {
      try {
        execaSync('node', [
          path.join(REPO_ROOT, 'packages/cdd-engine/dist/cli.mjs'),
          '--dry-run', 'fix', '--type', 'branch', ...args,
        ].map((x) => (x === '<PLAN>' ? planPath : x === '<FINDINGS>' ? findingsPath : x)),
          { cwd: dir, env: { ...process.env, CLAUDE_CODE_SESSION_ID: '1' }, encoding: 'utf8' });
      } catch (e: any) {
        r = { exitCode: e.exitCode ?? 1, stderr: e.stderr ?? '', stdout: e.stdout ?? '' };
      }
      return r ?? { exitCode: 0, stderr: '', stdout: '' };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('missing --plan → exit 2', () => {
    const r = runCli(['--findings', '<FINDINGS>']);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/missing required --plan/);
  });

  it('missing --findings → exit 2', () => {
    const r = runCli(['--plan', '<PLAN>']);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/missing required --findings/);
  });

  it('--findings not naming a branch-review-{base7}..{head7}-r{R}.json file → exit 2 (round underivable)', () => {
    const dir = tmpGitRepo();
    const planPath = writeBranchChain(dir, 'test-plan-guard.md');
    const badFindings = path.join(dir, 'spec-review-3.json');
    try {
      let exitCode: number | null = null;
      try {
        execaSync('node', [
          path.join(REPO_ROOT, 'packages/cdd-engine/dist/cli.mjs'),
          '--dry-run', 'fix', '--type', 'branch', '--plan', planPath, '--findings', badFindings,
        ], { cwd: dir, env: { ...process.env, CLAUDE_CODE_SESSION_ID: '1' }, encoding: 'utf8' });
      } catch (e: any) {
        exitCode = e.exitCode ?? 1;
      }
      expect(exitCode).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ③ in-process loop closure (ghost registry + fake-cli; mirrors branch-review.test.ts e2e) ----
describe('branch-fix in-process loop closure', () => {
  it('fixes off the source review handoff (commits.base = reviewed range), passes the exit gate, and the fix commit moves the ref → re-review of the new ref is a new review', async () => {
    const dir = tmpGitRepo();
    const slug = 'test-plan-bf';
    const planPath = writeBranchChain(dir, `${slug}.md`);
    // The exit gate (validateCommitContract) rules at RETURN: a dirty tree → BLOCKED rewrite.
    // Everything the fake agent + this test write after setup must be gitignored
    // (`.osuperpowers/` handoffs + `*.head` probe), and everything else committed as fixtures.
    writeFileSync(path.join(dir, '.gitignore'), '.osuperpowers/\n*.head\n');
    const base = FULL_ID('a');
    const head = FULL_ID('b');
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    const { resolveWorkspace, handoffName, resolveNextRound } = await import('../../artifacts/handoff/naming.ts');
    const workspace = resolveWorkspace(planPath, dir);
    const reviewPath = path.join(workspace, handoffName('review', 'branch', { base7, head7, round: 1 }));
    const handoffPath = path.join(workspace, handoffName('fix', 'branch', { base7, head7, round: 1 }));
    mkdirSync(workspace, { recursive: true });
    // The source review handoff the fix reads: --findings IS the review handoff (same file).
    writeFileSync(reviewPath, JSON.stringify({
      task: 1, phase: 'branch-review', status: 'APPROVED',
      commits: { base, head }, findings: [], artifacts: {}, blocker: 'none',
    }));
    // fake-cli fix agent: writes the fix handoff (commits.base = reviewed range base, head = git HEAD
    // after its own commit) then creates the fix commit — the real agent's atomic fix+commit behavior.
    const binDir = mkdtempSync(path.join(tmpdir(), 'cdd-bf-fake-'));
    writeFileSync(path.join(binDir, 'fake-cli'),
      `#!/usr/bin/env bash\n` +
      `git commit --allow-empty -qm "fix"\n` +
      `HEAD=$(git rev-parse HEAD)\n` +
      `cat > "${handoffPath}" <<EOF\n` +
      `{"task":1,"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"$HEAD"},"findings":[],"artifacts":{}}\n` +
      `EOF\n` +
      `git rev-parse HEAD > "${path.join(dir, 'fix-after-commit.head')}"\n` +
      `exit 0\n`);
    chmodSync(path.join(binDir, 'fake-cli'), 0o755);
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    const { REG_PATH } = await import('../../infra/registry.ts');
    const regPath = path.join(dir, 'registry.json');
    const reg = JSON.parse(readFileSync(REG_PATH, 'utf8'));
    reg.ghost = { cli: 'fake-cli', invoke: '-p', output: 'text', ship: 'full' };
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    // Commit the fixtures (plan + .gitignore + ghost registry) ONCE — the clean-tree exit gate
    // later requires zero non-ignored untracked/modified files at return.
    execaSync('git', ['-C', dir, 'add', '-A']);
    execaSync('git', ['-C', dir, '-c', 'user.name=cdd-test', '-c', 'user.email=cdd-test@example.com', 'commit', '-qm', 'fixtures']);
    try {
      const { ExitRequested } = await import('../../infra/exit.ts');
      const { runBranchFix } = await import('../branch-fix.ts');
      let exitCode: number | null = null;
      try {
        await runBranchFix({ harness: 'ghost', plan: planPath, findings: reviewPath, type: 'branch', root: dir, registryPath: regPath });
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      // The fix round completed cleanly: runBranchFix lands on exitOk() → ExitRequested(0)
      // (exit gate passed: fake commit → clean tree + handoff head matches actual HEAD).
      expect(exitCode).toBe(0);

      const h = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(h.phase).toBe('fix');
      expect(h.status).toBe('APPROVED');
      // commits.base = the reviewed range base (TASK_FIXED_POINT); head = the fix's own HEAD.
      expect(h.commits.base).toBe(base);
      // The fake agent committed — the new HEAD is a NEW ref.
      const newHead = readFileSync(path.join(dir, 'fix-after-commit.head'), 'utf8').trim();
      const newHead7 = newHead.slice(0, 7);
      expect(newHead).not.toBe(head);

      // Ref-moved = new review: a branch-review on the NEW ref resolves round 1 (never falsely
      // stopped by the old ref's APPROVED round) — the BASE..HEAD Convergence law.
      expect(resolveNextRound(workspace, 'review', 'branch', { base7, head7: newHead7 })).toBe(1);
      // The OLD ref keeps its own lineage: round 2 (the fix consumed nothing from the review
      // sequence — same-ref re-review remains a continuation, Convergence decides at dispatch).
      expect(resolveNextRound(workspace, 'review', 'branch', { base7, head7 })).toBe(2);
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ④ exit gate (commit contract): F1 head-mismatch + dirty-tree BLOCKED carrier rewrite ----
describe('branch-fix exit gate — the inherited commit-contract BLOCKED lanes', () => {
  const setup = async () => {
    const dir = tmpGitRepo();
    const slug = 'test-plan-bf-gate';
    const planPath = writeBranchChain(dir, `${slug}.md`);
    // The exit gate rules at RETURN: a dirty tree, or a clean tree whose handoff commits.head
    // mismatches actual HEAD (F1), rewrites the fix handoff to BLOCKED and exits 1. Everything the
    // fake agent writes after setup must be gitignored (`.osuperpowers/` handoffs + `*.head`
    // probes), and everything else committed as fixtures.
    writeFileSync(path.join(dir, '.gitignore'), '.osuperpowers/\n*.head\n');
    const base = FULL_ID('a');
    const head = FULL_ID('b');
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    const { resolveWorkspace, handoffName } = await import('../../artifacts/handoff/naming.ts');
    const workspace = resolveWorkspace(planPath, dir);
    const reviewPath = path.join(workspace, handoffName('review', 'branch', { base7, head7, round: 1 }));
    const handoffPath = path.join(workspace, handoffName('fix', 'branch', { base7, head7, round: 1 }));
    mkdirSync(workspace, { recursive: true });
    // The source review handoff the fix reads: --findings IS the review handoff (same file).
    writeFileSync(reviewPath, JSON.stringify({
      task: 1, phase: 'branch-review', status: 'APPROVED',
      commits: { base, head }, findings: [], artifacts: {}, blocker: 'none',
    }));
    return { dir, planPath, reviewPath, handoffPath, base, head };
  };

  // Ghost registry + PATH fake-cli (same harness shape as the loop-closure lane); `script` is the
  // fake agent's bash body, run with the repo root as cwd.
  const installFakeCli = async (dir: string, script: string) => {
    const binDir = mkdtempSync(path.join(tmpdir(), 'cdd-bf-fake-'));
    writeFileSync(path.join(binDir, 'fake-cli'), `#!/usr/bin/env bash\n${script}`);
    chmodSync(path.join(binDir, 'fake-cli'), 0o755);
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    const { REG_PATH } = await import('../../infra/registry.ts');
    const regPath = path.join(dir, 'registry.json');
    const reg = JSON.parse(readFileSync(REG_PATH, 'utf8'));
    reg.ghost = { cli: 'fake-cli', invoke: '-p', output: 'text', ship: 'full' };
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    // Commit the fixtures (plan + .gitignore + ghost registry) ONCE — the clean-tree exit gate
    // later requires zero non-ignored untracked/modified files at return.
    execaSync('git', ['-C', dir, 'add', '-A']);
    execaSync('git', ['-C', dir, '-c', 'user.name=cdd-test', '-c', 'user.email=cdd-test@example.com', 'commit', '-qm', 'fixtures']);
    return { origPath, regPath };
  };

  it('F1: clean tree + handoff commits.head ≠ actual HEAD → exit 1 + on-disk fix handoff rewritten to BLOCKED', async () => {
    const { dir, planPath, reviewPath, handoffPath, base } = await setup();
    // A 40-hex ref that is NOT the repo HEAD — the agent declared a different commit than it made.
    const wrongHead = FULL_ID('c');
    const { origPath, regPath } = await installFakeCli(dir,
      `cat > "${handoffPath}" <<EOF\n` +
      `{"task":1,"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"${wrongHead}"},"findings":[],"artifacts":{}}\n` +
      `EOF\n` +
      `exit 0\n`);
    try {
      const { ExitRequested } = await import('../../infra/exit.ts');
      const { runBranchFix } = await import('../branch-fix.ts');
      let exitCode: number | null = null;
      try {
        await runBranchFix({ harness: 'ghost', plan: planPath, findings: reviewPath, type: 'branch', root: dir, registryPath: regPath });
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      // The inherited exit gate turned the F1 violation into BLOCKED + exit 1 (previously the
      // unthreaded handoff path silently no-opped the gate and this round exited APPROVED).
      expect(exitCode).toBe(1);
      const h = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(h.status).toBe('BLOCKED');
      expect(h.blocker).toMatch(/does not match HEAD/);
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('dirty tree at return → exit 1 + on-disk fix handoff rewritten to BLOCKED carrier', async () => {
    const { dir, planPath, reviewPath, handoffPath, base } = await setup();
    const { origPath, regPath } = await installFakeCli(dir,
      `git commit --allow-empty -qm "fix"\n` +
      `HEAD=$(git rev-parse HEAD)\n` +
      `cat > "${handoffPath}" <<EOF\n` +
      `{"task":1,"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"$HEAD"},"findings":[],"artifacts":{}}\n` +
      `EOF\n` +
      `printf 'dirty\\n' > "${dir}/dirty.tmp"\n` +
      `exit 0\n`);
    try {
      const { ExitRequested } = await import('../../infra/exit.ts');
      const { runBranchFix } = await import('../branch-fix.ts');
      let exitCode: number | null = null;
      try {
        await runBranchFix({ harness: 'ghost', plan: planPath, findings: reviewPath, type: 'branch', root: dir, registryPath: regPath });
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      expect(exitCode).toBe(1);
      // The dirty-tree BLOCKED carrier rewrite: the on-disk fix handoff now carries the engine's
      // BLOCKED conclusion (not the agent's declared APPROVED) + the dirty-tree blocker.
      const h = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(h.status).toBe('BLOCKED');
      expect(h.blocker).toMatch(/uncommitted changes at return/);
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('F1 no-root path: getRoot() fallback (initRoot primed like bin.ts:87, no opts.root) still enforces the exit gate', async () => {
    const { dir, planPath, reviewPath, handoffPath, base } = await setup();
    // The CLI wrapper seeds ctx.repoRoot = opts.root ?? null while fixCmd/reviewCmd declare no
    // --root, so on the real black-box walk the channel resolves its root from getRoot() (the
    // initRoot()-initialized singleton). This lane replicates that walk: initRoot primed like
    // bin.ts:87, NO opts.root injected — the resolveContext threading (repoRoot → ctx) must still
    // feed the resolved root to the inherited exit gate. Before the threading, ctx.repoRoot stayed
    // null here → validateCommitContract → resolveCleanTree(null) → fail-open → APPROVED (the
    // fix-1 gap this round closes). Same wrong-HEAD F1 probe as the root-injected lane above.
    const wrongHead = FULL_ID('c');
    const { origPath, regPath } = await installFakeCli(dir,
      `cat > "${handoffPath}" <<EOF\n` +
      `{"task":1,"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"${wrongHead}"},"findings":[],"artifacts":{}}\n` +
      `EOF\n` +
      `exit 0\n`);
    try {
      const { ExitRequested } = await import('../../infra/exit.ts');
      const { initRoot } = await import('../../infra/root.ts');
      const { runBranchFix } = await import('../branch-fix.ts');
      await initRoot(dir);
      let exitCode: number | null = null;
      try {
        await runBranchFix({ harness: 'ghost', plan: planPath, findings: reviewPath, type: 'branch', registryPath: regPath });
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      expect(exitCode).toBe(1);
      const h = JSON.parse(readFileSync(handoffPath, 'utf8'));
      expect(h.status).toBe('BLOCKED');
      expect(h.blocker).toMatch(/does not match HEAD/);
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
