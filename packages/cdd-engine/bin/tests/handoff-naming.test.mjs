// bin/tests/handoff-naming.test.mjs — handoff-namespace canonical 派生层 round-trip 测试。
// Seams: handoffName / roundPattern / resolveNextRound / prevHandoffPath / resolveWorkspace / workspaceSlug
// 六个纯函数公共接口（不碰 子进程 git / review-loop 消费方 —— 后者归 T3）。
import { it, expect } from "vitest";
import {
  handoffName, roundPattern, resolveNextRound, prevHandoffPath,
  resolveWorkspace, workspaceSlug,
} from "../lib/handoff-naming.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

it("handoffName: spec review → spec-review-2.json", () => {
  expect(handoffName("review", "spec", { round: 2 })).toBe("spec-review-2.json");
});
it("handoffName: task fix → task-3-fix-4.json", () => {
  expect(handoffName("fix", "task", { task: 3, round: 4 })).toBe("task-3-fix-4.json");
});
it("handoffName: branch review embeds base7..head7 + r{round}", () => {
  expect(handoffName("review", "branch", { base7: "abc1234", head7: "def5678", round: 1 }))
    .toBe("branch-review-abc1234..def5678-r1.json");
});
it("roundPattern scan 形态: spec-review-2.json 可被匹配", () => {
  expect("spec-review-2.json").toMatch(roundPattern("review", "spec"));
  expect("spec-1.json").not.toMatch(roundPattern("review", "spec"));
});
it("roundPattern concrete 形态: 指定 base7/head7 才匹配 branch", () => {
  const re = roundPattern("review", "branch", { base7: "abc1234", head7: "def5678" });
  expect("branch-review-abc1234..def5678-r1.json").toMatch(re);
  expect("branch-review-1111111..2222222-r1.json").not.toMatch(re);
});
it("resolveNextRound: 写 spec-review-1.json 后 → 2", () => {
  const ws = mkdtempSync(join(tmpdir(), "hn-"));
  writeFileSync(join(ws, "spec-review-1.json"), "{}");
  expect(resolveNextRound(ws, "review", "spec")).toBe(2);
});
it("prevHandoffPath: 同族 round-1（review.spec R=2 → spec-review-1.json）", () => {
  expect(prevHandoffPath("/ws", "review", "spec", 2)).toBe("/ws/spec-review-1.json");
});
it("prevHandoffPath: 跨族 task review R=1 → implement；R>1 → fix.task:R-1", () => {
  expect(prevHandoffPath("/ws", "review", "task", 1, { task: 5 })).toBe("/ws/task-5-implement.json");
  expect(prevHandoffPath("/ws", "review", "task", 3, { task: 5 })).toBe("/ws/task-5-fix-2.json");
});
it("prevHandoffPath: fix 族 → 源 review 同 round", () => {
  expect(prevHandoffPath("/ws", "fix", "spec", 2)).toBe("/ws/spec-review-2.json");
});
it("resolveWorkspace: spec-design.md 与 plan.md 收敛同 slug workspace", () => {
  const specWs = resolveWorkspace("/repo/docs/superpowers/specs/2026-09-08-foo-design.md");
  const planWs = resolveWorkspace("/repo/docs/superpowers/plans/2026-09-08-foo.md");
  expect(specWs).toBe("/repo/.superpowers/cdd/2026-09-08-foo");
  expect(planWs).toBe(specWs);
});
it("resolveWorkspace: 仅文件名派生，不依赖 plan 文件存在", () => {
  expect(workspaceSlug("2026-09-08-foo-design.md")).toBe("2026-09-08-foo");
  expect(workspaceSlug("2026-09-08-foo.md")).toBe("2026-09-08-foo");
});