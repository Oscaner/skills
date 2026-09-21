// packages/cdd-engine/src/render/__tests__/templates.content.test.ts — Task 20 (模板系统化终态) ⑧
// position-sensitive assertions migrate from handwritten-template reads to RENDERED-prompt checks:
// the four template .md files are deleted (zero handwritten templates); this file renders the real
// prompts via the single renderer (templates.ts — real contract + schemas reads, no fs mock) and
// pins the shipped-prompt contract: byte-identical literal header, 壳 → ## Return → ## Round
// context segment order, byte-frozen per-format Return constants, gate values riding the round
// slots (门面去路径化), shared commit/evidence prose.
import { describe, it, expect } from 'vitest';

import {
  renderModePrompt,
  renderTemplate,
  reviewHardGate,
  docsFixHardGate,
} from '../templates.ts';

const IMPLEMENT_PARAMS = {
  TASK_WORKSPACE: '/ws/osuperpowers-overhaul-p6',
  WORKSPACE_SLUG: 'osuperpowers-overhaul-p6',
  TASK_BRIEF: '/ws/osuperpowers-overhaul-p6/task-7-brief.md',
  HANDOFF_TARGET: '/ws/osuperpowers-overhaul-p6/task-7-implement.json',
  TASK_FINDINGS: '',
  TASK_CONSTRAINTS: '/ws/osuperpowers-overhaul-p6/plan-constraints.md',
  TASK_FIXED_POINT: '',
  TASK_NUMBER: '7',
  REVIEW_PLAN_LINE: '',
};

// Second-level heading position via line-anchored match — the shell prose names `## Return` /
// `## Round context` inline (backtick quotes in Instructions), so a plain indexOf would anchor on
// the prose mention, not the real section heading.
const heading = (prompt: string, name: string): number => prompt.search(new RegExp(`^## ${name}$`, 'm'));

// The static zone = the rendered prompt before the `## Return` heading (the whole shell incl. the
// injected schema block; the variant payload is tailed after `## Return`).
const staticZoneOf = (prompt: string): string => prompt.slice(0, heading(prompt, 'Return'));
// The byte-frozen per-format Return constant region (between `## Return` and the dynamic tail).
const returnZoneOf = (prompt: string): string =>
  prompt.slice(heading(prompt, 'Return'), heading(prompt, 'Round context'));

function fixtureRenders(): Record<string, string> {
  return {
    implement: renderModePrompt('implement', IMPLEMENT_PARAMS),
    fix: renderModePrompt('fix', {
      ...IMPLEMENT_PARAMS,
      HANDOFF_TARGET: '/ws/osuperpowers-overhaul-p6/task-7-fix-1.json',
      TASK_FINDINGS: '/ws/osuperpowers-overhaul-p6/task-7-review-1.json',
      TASK_FIXED_POINT: '7a7327b',
    }),
    taskReview: renderModePrompt('review', {
      TASK_WORKSPACE: IMPLEMENT_PARAMS.TASK_WORKSPACE,
      WORKSPACE_SLUG: IMPLEMENT_PARAMS.WORKSPACE_SLUG,
      HANDOFF_TARGET: '/ws/osuperpowers-overhaul-p6/task-7-review-1.json',
      TASK_FIXED_POINT: '7a7327b',
    }),
    docsReview: renderTemplate('review', {
      MODE: 'review',
      REVIEW_TYPE: 'spec',
      TASK_WORKSPACE: IMPLEMENT_PARAMS.TASK_WORKSPACE,
      WORKSPACE_SLUG: IMPLEMENT_PARAMS.WORKSPACE_SLUG,
      REVIEW_LENS_GUIDE: 'completeness · consistency · clarity',
      REVIEW_REFERENCE: '/ws/osuperpowers-overhaul-p6/spec-design.md',
      REVIEW_AXES: 'Follow URC: single-cycle; lens-tag every finding',
      REVIEW_PLAN_LINE: '**Spec:** /ws/osuperpowers-overhaul-p6/specs/design.md',
      DOCS_DOC: '',
      DOCS_FINDINGS: '',
      HANDOFF_TARGET: '/ws/osuperpowers-overhaul-p6/spec-review-1.json',
      RETURN_FORMAT: 'RETURN_JSON',
      HANDOFF_WRITE_GATE: reviewHardGate('RETURN_JSON', '/ws/osuperpowers-overhaul-p6/spec-review-1.json'),
    }),
    docsFix: renderTemplate('fix', {
      MODE: 'fix',
      REVIEW_TYPE: '',
      TASK_WORKSPACE: IMPLEMENT_PARAMS.TASK_WORKSPACE,
      WORKSPACE_SLUG: IMPLEMENT_PARAMS.WORKSPACE_SLUG,
      REVIEW_LENS_GUIDE: '',
      REVIEW_REFERENCE: '',
      REVIEW_AXES: '',
      REVIEW_PLAN_LINE: '',
      DOCS_DOC: '/ws/osuperpowers-overhaul-p6/spec-design.md',
      DOCS_FINDINGS: '/ws/osuperpowers-overhaul-p6/spec-review-1.json',
      DOCS_FIXED_POINT: '7a7327b',
      HANDOFF_TARGET: '/ws/osuperpowers-overhaul-p6/spec-fix-1.json',
      RETURN_FORMAT: 'DOCS_FIX',
      HANDOFF_WRITE_GATE: docsFixHardGate('/ws/osuperpowers-overhaul-p6/spec-fix-1.json'),
    }),
  };
}

describe('unified constant shell（Task 20 ①）：字面头跨模式字节恒等 + 三区段序锁定', () => {
  const renders = fixtureRenders();
  const HEADER = '# CDD dispatch — CLI session';

  it('四种 mode 渲染输出的首行字面头字节恒等', () => {
    for (const [mode, prompt] of Object.entries(renders)) {
      expect(prompt.split('\n')[0], mode).toBe(HEADER);
    }
  });

  it('段序恒为 壳 → ## Return → ## Round context；Round context 为唯一动态区（绝对末尾）', () => {
    for (const [mode, prompt] of Object.entries(renders)) {
      const handoffIdx = heading(prompt, 'Handoff');
      const retIdx = heading(prompt, 'Return');
      const roundIdx = heading(prompt, 'Round context');
      expect(handoffIdx, mode).toBeGreaterThan(-1);
      expect(retIdx, mode).toBeGreaterThan(handoffIdx);   // Handoff 壳在 Return 前
      expect(roundIdx, mode).toBeGreaterThan(retIdx);     // 动态区绝对末尾
      const after = prompt.slice(roundIdx);
      expect(after.startsWith('## Round context'), mode).toBe(true);
      expect(after.match(/\n## (?!#)/), mode).toBeNull(); // Round context 之后无其他二级段
      expect(heading(prompt, 'Round context'), mode).toBe(prompt.lastIndexOf('## Round context'));
    }
  });

  it('Return 常数为字节常数（按 returnFormat 冻结）；同一格式跨 mode 恒等', () => {
    const { implement, fix, taskReview, docsReview, docsFix } = renders;
    // RETURN_STDOUT_BLOCK（implement / fix / task review 共用）
    expect(returnZoneOf(implement)).toBe(returnZoneOf(fix));
    expect(returnZoneOf(fix)).toBe(returnZoneOf(taskReview));
    // 每种 returnFormat 自带 `## Return` 头 + 零 moustache（结构校验器同断言，此处为渲染面直读）
    expect(returnZoneOf(implement).startsWith('## Return')).toBe(true);
    expect(returnZoneOf(implement)).not.toContain('{{');
    expect(returnZoneOf(docsReview)).toContain('RETURN_JSON'); // 格式标签自述
    expect(returnZoneOf(docsFix)).toContain('not your stdout');
  });

  it('壳 = 进程级无参常数：同一 family 的静态区（schema 注入块之前 + 之后）字节冻结；跨 family 仅 schema 块区异', () => {
    const { implement, fix, taskReview, docsReview, docsFix } = renders;
    expect(staticZoneOf(implement)).toBe(staticZoneOf(fix));     // task 族
    expect(staticZoneOf(fix)).toBe(staticZoneOf(taskReview));
    expect(staticZoneOf(docsReview)).toBe(staticZoneOf(docsFix)); // docs 族
    expect(staticZoneOf(implement)).not.toBe(staticZoneOf(docsReview)); // 两族差异 = 注入 schema 块
    const taskSchema = staticZoneOf(implement).slice(staticZoneOf(implement).indexOf('```json'));
    const docsSchema = staticZoneOf(docsReview).slice(staticZoneOf(docsReview).indexOf('```json'));
    expect(taskSchema).not.toBe(docsSchema);
  });

  it('WORKSPACE_SLUG 槽就位（⑦ canonical slug）：renderModePrompt(implement) 渲染实值', () => {
    expect(renders.implement).toContain('- `WORKSPACE_SLUG`: osuperpowers-overhaul-p6');
  });

  it('T5: DOCS_FIXED_POINT 槽就位（canonical 派生）——docs 面渲染实值，其他 mode 空预填', () => {
    // docs fix 渲染实值（与 task 族 TASK_FIXED_POINT 同位语义 = dispatch 入口 base）
    expect(renders.docsFix).toContain('- `DOCS_FIXED_POINT`: 7a7327b');
    // mode-union 模板：未传值的 mode 空预填槽仍渲染（docs review / task 族同）
    expect(renders.docsReview).toContain('- `DOCS_FIXED_POINT`: ');
    expect(renders.implement).toContain('- `DOCS_FIXED_POINT`: ');
  });
});

describe('my-gate 门面去路径化（Task 20 ⑥）：壳散文字节常数，实值入 Round context 槽', () => {
  it('task review 门：gate 值（含目标路径）在 `### HANDOFF_WRITE_GATE` 槽 / BEFORE outputting the RETURN_STDOUT_BLOCK', () => {
    const out = fixtureRenders().taskReview;
    expect(out).toMatch(/HARD GATE[^\n]*BEFORE outputting the RETURN_STDOUT_BLOCK/);
    expect(out).toContain('/ws/osuperpowers-overhaul-p6/task-7-review-1.json');
    expect(out).toContain('### HANDOFF_WRITE_GATE');
    expect(out).not.toContain('BEFORE outputting the JSON return');
  });

  it('docs review（RETURN_JSON）门：/ BEFORE outputting the JSON return / + RETURN_JSON 常量文本', () => {
    const out = fixtureRenders().docsReview;
    expect(out).toMatch(/HARD GATE[^\n]*BEFORE outputting the JSON return/);
    expect(out).not.toContain('BEFORE outputting the RETURN_STDOUT_BLOCK');
    expect(out).toContain('/ws/osuperpowers-overhaul-p6/spec-review-1.json');
    expect(out).toContain('This review\'s `returnFormat` is **RETURN_JSON**');
  });

  it('docs fix（DOCS_FIX）门：fix return = 写盘 —— / BEFORE exiting / + the engine reads the file, not your stdout', () => {
    const out = fixtureRenders().docsFix;
    expect(out).toMatch(/HARD GATE[^\n]*BEFORE exiting/);
    expect(out).toContain('the engine reads the file, not your stdout');
    expect(out).not.toContain('outputting the JSON return'); // fix stdout 无 JSON return
    expect(out).toContain('/ws/osuperpowers-overhaul-p6/spec-fix-1.json');
    expect(out).toContain('Write/update `HANDOFF_TARGET` per the schema'); // DOCS_FIX 常量自述
  });

  it('implement 门：本模式不写 handoff —— runner 从 return block + TASK_BASE + git HEAD 实体化', () => {
    const out = fixtureRenders().implement;
    expect(out).toMatch(/This mode does not write `[^`]+task-7-implement\.json`/);   // 槽实值
    expect(out).toContain('does not write a handoff');                                // 壳指令 3
    expect(out).toContain('the runner materializes it from your return block four lines');      // 槽散文
    expect(out).toContain('TASK_BASE');
  });
});

describe('共享纪律散文（壳 Instructions，跨 mode 同一字节）：evidence gate + commit contract + status 决策', () => {
  it('evidence gate（指令 7）：behavior_change / command / passed / exit_code 句在 implement + fix + docs fix 渲染内', () => {
    for (const [mode, out] of Object.entries(fixtureRenders())) {
      expect(out, mode).toMatch(/task-N-test-evidence\.json/);
      expect(out, mode).toContain('behavior_change');
      expect(out, mode).toContain('`command`');
      expect(out, mode).toContain('`passed`');
      expect(out, mode).toContain('`exit_code`');
    }
  });

  it('commit contract（指令 8，task-family isomorphic）：conventional commit / attribution / no commit / out-of-scope / BLOCKED', () => {
    for (const [mode, out] of Object.entries(fixtureRenders())) {
      expect(out, mode).toContain('conventional commit');
      expect(out, mode).toContain('no attribution / co-author / AI-generation trailers');
      expect(out, mode).toContain('no commit');     // No fix-scope diff → no commit
      expect(out, mode).toContain('out-of-scope');
      expect(out, mode).toContain('Uncommitted changes at return → `status: BLOCKED`');
    }
  });

  it('fix status 决策（共享 Handoff 壳）：work-type declare status（APPROVED once applied, or BLOCKED with reason in blocker）', () => {
    const out = fixtureRenders().fix;
    expect(out).toMatch(/declare `status` \(APPROVED once applied, or BLOCKED with the reason in `blocker`\)/);
    expect(out).toContain('fix-scope diff');      // fix 指令 4（FIX_BASE）
    expect(out).toContain('`TASK_FIXED_POINT`');  // 指令 4 实值源在 Round context
  });

  it('渲染输出零残留 moustache（r2-r3 泄漏回归守卫，迁移：{{HANDOFF_SCHEMA_JSON}} 槽已消）', () => {
    for (const prompt of Object.values(fixtureRenders())) {
      expect(prompt).not.toContain('{{');
    }
  });
});
