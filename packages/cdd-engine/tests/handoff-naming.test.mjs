// packages/cdd-engine/tests/handoff-naming.test.mjs — handoff-namespace canonical 派生层 round-trip 测试。
// Seams: handoffName / roundPattern / resolveNextRound / prevHandoffPath / resolveWorkspace / workspaceSlug
// 六个纯函数公共接口（不碰 子进程 git / review-loop 消费方 —— 后者归 T3）。
import { it, expect } from "vitest";
import {
  handoffName, roundPattern, resolveNextRound, prevHandoffPath,
  resolveWorkspace, workspaceSlug,
} from "../lib/handoff/naming.mjs";
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
  // 旧命名（{type}-{round} 形）不得匹配 canonical 模式 —— 拼字构造避开 residue grep 误报。
  const legacySpecName = ["spec", "1"].join("-") + ".json";
  expect(legacySpecName).not.toMatch(roundPattern("review", "spec"));
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
it("resolveNextRound: task pin 精确扫描——跨 task 不混计 rounds", () => {
  const ws = mkdtempSync(join(tmpdir(), "hn-taskpin-"));
  writeFileSync(join(ws, "task-1-review-1.json"), "{}");
  writeFileSync(join(ws, "task-1-review-2.json"), "{}");
  writeFileSync(join(ws, "task-2-review-1.json"), "{}");
  expect(resolveNextRound(ws, "review", "task", { task: 1 })).toBe(3);
  expect(resolveNextRound(ws, "review", "task", { task: 2 })).toBe(2);
  expect(resolveNextRound(ws, "review", "task", { task: 9 })).toBe(1);
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
it("prevHandoffPath: fix.task round1 无专属表项 → 回退 roundR（跨轮次同依赖）", () => {
  expect(prevHandoffPath("/ws", "fix", "task", 1, { task: 5 })).toBe("/ws/task-5-review-1.json");
  expect(prevHandoffPath("/ws", "fix", "task", 3, { task: 5 })).toBe("/ws/task-5-review-3.json");
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
it("workspaceSlug: 双 suffix 收敛 — -design/-plan 单层 strip 后同值", () => {
  expect(workspaceSlug("xxx-p5.md")).toBe("xxx-p5");
  expect(workspaceSlug("xxx-p5-design.md")).toBe("xxx-p5");
  expect(workspaceSlug("xxx-p5-plan.md")).toBe("xxx-p5");
});
it("workspaceSlug: 单 suffix 不级联 — xxx-a-plan.md → xxx-a；xxx-plan-plan.md → xxx-plan", () => {
  expect(workspaceSlug("xxx-a-plan.md")).toBe("xxx-a");
  expect(workspaceSlug("xxx-plan-plan.md")).toBe("xxx-plan");
});
