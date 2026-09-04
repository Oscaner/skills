// packages/cdd-engine/bin/tests/templates.content.test.mjs
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..', '..');

describe('task-review.md Bug C regression', () => {
  it('## Handoff Output appears before ## Return (H1)', () => {
    const content = readFileSync(
      path.join(PKG_ROOT, 'templates', 'task-review.md'),
      'utf8'
    );
    const handoffIdx = content.indexOf('## Handoff Output');
    const returnIdx  = content.indexOf('## Return (H1');
    expect(handoffIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(-1);
    expect(handoffIdx).toBeLessThan(returnIdx);
  });

  it('contains HARD GATE instruction', () => {
    const content = readFileSync(
      path.join(PKG_ROOT, 'templates', 'task-review.md'),
      'utf8'
    );
    expect(content).toContain('HARD GATE');
    expect(content).toContain('Write `{{HANDOFF}}` BEFORE');
  });
});

describe('branch-review.md semantic fix', () => {
  it('does not contain doc_path field instruction', () => {
    const content = readFileSync(
      path.join(PKG_ROOT, 'templates', 'branch-review.md'), 'utf8'
    );
    expect(content).not.toContain('`doc_path`');
  });
});