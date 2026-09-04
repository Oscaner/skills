// bin/tests/select.test.mjs — Vitest port of cdd-select.mjs detection + recommendation tests
// (hermetic mock PATH). Commander migration: cdd-select has no explicit args — Commander
// primarily provides --help; detection/recommendation logic is unchanged.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from '../utils/skills-probe.config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // packages/cdd-engine/bin/tests
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const SELECT_MJS = path.join(REPO_ROOT, 'packages/cdd-engine/bin/cdd-select.mjs');

// Test env: strip any CDD_* inherited from an orchestrator session.
function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('CDD_')) env[k] = v;
  }
  return { ...env, ...extra };
}

function mockDirWithBins(bins) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cdd-select-mock-'));
  for (const b of bins) {
    writeFileSync(path.join(dir, b), '#!/bin/sh\nexit 0\n');
    chmodSync(path.join(dir, b), 0o755);
  }
  return dir;
}

// Drop PATH directories that contain any harness CLI binary — neither the mock CLI nor the
// real one may leak in.
function harnessFreePath() {
  const clis = Object.values(config.harnesses).map((h) => h.cli).filter(Boolean);
  return process.env.PATH.split(path.delimiter)
    .filter((d) => d && !clis.some((b) => {
      try {
        const st = statSync(path.join(d, b));
        return st.isFile() && (st.mode & 0o111) !== 0;
      } catch {
        return false;
      }
    }))
    .join(path.delimiter);
}

function runSelect(extraEnv = {}) {
  const env = cleanEnv(extraEnv);
  env.PATH = `${mock}${path.delimiter}${harnessFreePath()}`;
  const res = spawnSync('node', [SELECT_MJS], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

let mock;
function resetMock(bins) {
  if (mock) rmSync(mock, { recursive: true, force: true });
  mock = mockDirWithBins(bins);
}

describe('cdd-select.mjs detection + recommendation', () => {
  it('droid+pi+claude+codex installed → available alphabetically + recommended=droid', () => {
    resetMock(['droid', 'pi', 'claude', 'codex']);
    const res = runSelect();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/available:claude,codex,droid,pi/);
    expect(res.stdout).toMatch(/unsupported_installed:$/m);
    expect(res.stdout).toMatch(/recommended:droid/);
  });

  it('only pi installed → recommended=pi', () => {
    resetMock(['pi']);
    const res = runSelect();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/recommended:pi/);
  });

  it('no installable harness → BLOCKED exit 1', () => {
    resetMock([]);
    const res = runSelect();
    expect(res.status).not.toBe(0);
    expect(res.stdout).toMatch(/^available:$/m);
    expect(res.stderr).toMatch(/BLOCKED: no full harness installed/);
  });

  it('current harness detection — CURSOR_TRACE_ID → cursor-agent', () => {
    resetMock(['claude', 'cursor-agent']);
    const res = runSelect({ CURSOR_TRACE_ID: '1' });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/recommended:cursor-agent/);
  });

  it('no current harness → first alphabetically available', () => {
    resetMock(['claude', 'cursor-agent']);
    const res = runSelect({});
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/recommended:claude/);
  });
});