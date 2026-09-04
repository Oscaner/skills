// bin/tests/session-activate.test.mjs — Vitest port of cdd-session-activate.mjs pending-cdd
// write behavior (spec §E mode-aware): minimal/bind subcommands, --mode beats
// CDD_SESSION_MODE env, empty → fail-open (omit mode), invalid mode → exit 2,
// bind-existing preserves prior mode, CDD_PENDING_ROOT / TMPDIR default root.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/bin/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const ACTIVATE_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd-session-activate.mjs');

// Test env: strip any CDD_* inherited from an orchestrator session (session-activate reads
// CDD_SESSION_MODE / CDD_PENDING_ROOT).
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  return { ...env, ...extra };
}

function runActivate(args, extraEnv = {}) {
  const res = spawnSync('node', [ACTIVATE_MJS, ...args], {
    cwd: REPO_ROOT,
    env: cleanEnv(extraEnv),
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function readPending(root, key) {
  return JSON.parse(readFileSync(path.join(root, `${key}.json`), 'utf8'));
}

describe('cdd-session-activate.mjs pending-cdd writes', () => {
  it('minimal → trigger/session_key/repo_root/detected_at (mode omitted when none given)', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const res = runActivate(['minimal', 'sess-1', '/repo/root'], { CDD_PENDING_ROOT: root });
    expect(res.status, res.stderr).toBe(0);
    const p = readPending(root, 'sess-1');
    expect(p.trigger).toBe('cdd-orchestrator');
    expect(p.session_key).toBe('sess-1');
    expect(p.repo_root).toBe('/repo/root');
    expect(typeof p.detected_at).toBe('number');
    expect(p).not.toHaveProperty('mode');
  });

  it('minimal --mode cli → mode field written as cli', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const res = runActivate(['minimal', 'sess-2', '/repo', '--mode', 'cli'], { CDD_PENDING_ROOT: root });
    expect(res.status, res.stderr).toBe(0);
    expect(readPending(root, 'sess-2').mode).toBe('cli');
  });

  it('minimal --mode=subagent → mode field written as subagent', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const res = runActivate(['minimal', 'sess-3', '/repo', '--mode=subagent'], { CDD_PENDING_ROOT: root });
    expect(res.status, res.stderr).toBe(0);
    expect(readPending(root, 'sess-3').mode).toBe('subagent');
  });

  it('bind fresh → plan_path/workspace/active_task:null + trigger', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const res = runActivate(['bind', 'sess-b', '/repo', '/plan.md', '/ws'], { CDD_PENDING_ROOT: root });
    expect(res.status, res.stderr).toBe(0);
    const p = readPending(root, 'sess-b');
    expect(p.trigger).toBe('cdd-orchestrator');
    expect(p.session_key).toBe('sess-b');
    expect(p.repo_root).toBe('/repo');
    expect(p.plan_path).toBe('/plan.md');
    expect(p.workspace).toBe('/ws');
    expect(p.active_task).toBeNull();
  });

  it('bind-existing without --mode → keeps prior mode cli', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const first = runActivate(['minimal', 'sess-bx', '/repo', '--mode', 'cli'], { CDD_PENDING_ROOT: root });
    expect(first.status).toBe(0);
    const res = runActivate(['bind', 'sess-bx', '/repo', '/plan.md', '/ws'], { CDD_PENDING_ROOT: root });
    expect(res.status, res.stderr).toBe(0);
    const p = readPending(root, 'sess-bx');
    expect(p.mode).toBe('cli');
    expect(p.plan_path).toBe('/plan.md');
    expect(p.workspace).toBe('/ws');
    expect(p.active_task).toBeNull();
  });

  it('bind-existing with explicit --mode subagent → overrides prior mode', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const first = runActivate(['minimal', 'sess-bo', '/repo', '--mode', 'cli'], { CDD_PENDING_ROOT: root });
    expect(first.status).toBe(0);
    const res = runActivate(
      ['bind', 'sess-bo', '/repo', '/plan.md', '/ws', '--mode', 'subagent'],
      { CDD_PENDING_ROOT: root },
    );
    expect(res.status, res.stderr).toBe(0);
    expect(readPending(root, 'sess-bo').mode).toBe('subagent');
  });

  it('invalid mode → exit 2 and no pending written', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const res = runActivate(['minimal', 'sess-bad', '/repo', '--mode', 'bogus'], { CDD_PENDING_ROOT: root });
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/invalid mode: bogus \(expected in-session\|subagent\|cli\)/);
    expect(existsSync(path.join(root, 'sess-bad.json'))).toBe(false);
  });

  it('missing positional arg → usage stderr + exit 2', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const res = runActivate(['minimal', 'only-key'], { CDD_PENDING_ROOT: root });
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('unknown subcommand → usage stderr + exit 2', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cdd-pend-'));
    const res = runActivate(['frobnicate', 'sess-x', '/repo'], { CDD_PENDING_ROOT: root });
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/^usage: /);
  });

  it('CDD_PENDING_ROOT default → TMPDIR-derived pending root', () => {
    const t = mkdtempSync(path.join(tmpdir(), 'cdd-tmp-'));
    const res = runActivate(['minimal', 'sess-def', '/repo'], { TMPDIR: t });
    expect(res.status, res.stderr).toBe(0);
    const p = JSON.parse(readFileSync(path.join(t, 'osuperpowers', 'pending-cdd', 'sess-def.json'), 'utf8'));
    expect(p.session_key).toBe('sess-def');
  });
});