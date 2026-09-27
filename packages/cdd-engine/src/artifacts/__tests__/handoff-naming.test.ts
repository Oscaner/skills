// packages/cdd-engine/src/artifacts/__tests__/handoff-naming.test.ts
// Seams: handoffName / roundPattern / resolveNextRound / prevHandoffPath / resolveWorkspace / workspaceSlug
// 六个纯函数公共接口（不碰 子进程 git / review-loop 消费方 —— 后者归 T3）。

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { TaskGroup } from "../../domain/task-group.ts";
import {
  handoffName,
  prevHandoffPath,
  resolveNextRound,
  resolveWorkspace,
  roundPattern,
  workspaceSlug,
} from "../handoff/naming.ts";

it("handoffName: spec review → spec-review-2.json", () => {
  expect(handoffName("review", "spec", { round: 2 })).toBe("spec-review-2.json");
});
it("handoffName: task fix single group → tasks-3-fix-4.json", () => {
  expect(handoffName("fix", "task", { tasks: "3", round: 4 })).toBe("tasks-3-fix-4.json");
});
it("handoffName: task implement group → tasks-1,2-implement.json (group is the unit)", () => {
  expect(handoffName("implement", "task", { tasks: "1,2" })).toBe("tasks-1,2-implement.json");
});
it("handoffName: task review group carries round → tasks-1,2-review-1.json", () => {
  expect(handoffName("review", "task", { tasks: "1,2", round: 1 })).toBe("tasks-1,2-review-1.json");
});
it("TaskGroup key: the group key IS the canonical serialization (--tasks 1 → 1 · --tasks 1,2 → 1,2)", () => {
  expect(TaskGroup.fromNumbers([1]).key()).toBe("1");
  expect(TaskGroup.fromNumbers([1, 2]).key()).toBe("1,2");
  expect(TaskGroup.fromNumbers([3, 7, 12]).key()).toBe("3,7,12");
});
it("handoffName: branch review embeds base7..head7 + r{round}", () => {
  expect(handoffName("review", "branch", { base7: "abc1234", head7: "def5678", round: 1 })).toBe(
    "branch-review-abc1234..def5678-r1.json",
  );
});
it("handoffName: branch fix mirrors the source review's ref+round (fix.branch family, Task 9)", () => {
  expect(handoffName("fix", "branch", { base7: "abc1234", head7: "def5678", round: 2 })).toBe(
    "branch-fix-abc1234..def5678-r2.json",
  );
});
it("prevHandoffPath: fix.branch R → the source review.branch:R handoff（跨族 prev 表）", () => {
  expect(prevHandoffPath("ws", "fix", "branch", 3, { base7: "abc1234", head7: "def5678" })).toBe(
    join("ws", "branch-review-abc1234..def5678-r3.json"),
  );
});
it("roundPattern scan 形态: spec-review-2.json 可被匹配", () => {
  expect("spec-review-2.json").toMatch(roundPattern("review", "spec"));
  // 旧命名（{type}-{round} 形）不得匹配 canonical 模式 —— 拼字构造避开 residue grep 误报。
  const legacySpecName = `${["spec", "1"].join("-")}.json`;
  expect(legacySpecName).not.toMatch(roundPattern("review", "spec"));
});
it("roundPattern scan shape: task group naming tasks-{a},{b}-* matches (round capture group)", () => {
  expect("tasks-1-review-2.json").toMatch(roundPattern("review", "task"));
  expect("tasks-1,2-review-1.json").toMatch(roundPattern("review", "task"));
  expect("tasks-3,7,12-review-4.json").toMatch(roundPattern("review", "task"));
  // Legacy naming (task-{N} shape) must not match the canonical pattern — string-built to avoid residue grep false positives.
  const legacyTaskName = `${["task", "1", "review", "1"].join("-")}.json`;
  expect(legacyTaskName).not.toMatch(roundPattern("review", "task"));
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
it("resolveNextRound: group pin exact scan — rounds never mix across groups", () => {
  const ws = mkdtempSync(join(tmpdir(), "hn-grouppin-"));
  writeFileSync(join(ws, "tasks-1-review-1.json"), "{}");
  writeFileSync(join(ws, "tasks-1-review-2.json"), "{}");
  writeFileSync(join(ws, "tasks-1,2-review-1.json"), "{}");
  writeFileSync(join(ws, "tasks-2-review-1.json"), "{}");
  expect(resolveNextRound(ws, "review", "task", { tasks: "1" })).toBe(3);
  expect(resolveNextRound(ws, "review", "task", { tasks: "1,2" })).toBe(2);
  expect(resolveNextRound(ws, "review", "task", { tasks: "9" })).toBe(1);
});
it("prevHandoffPath: 同族 round-1（review.spec R=2 → spec-review-1.json）", () => {
  expect(prevHandoffPath("/ws", "review", "spec", 2)).toBe("/ws/spec-review-1.json");
});
it("prevHandoffPath: cross-family task review R=1 → implement; R>1 → fix.task:R-1 (group key)", () => {
  expect(prevHandoffPath("/ws", "review", "task", 1, { tasks: "5" })).toBe(
    "/ws/tasks-5-implement.json",
  );
  expect(prevHandoffPath("/ws", "review", "task", 3, { tasks: "1,2" })).toBe(
    "/ws/tasks-1,2-fix-2.json",
  );
});
it("prevHandoffPath: fix 族 → 源 review 同 round", () => {
  expect(prevHandoffPath("/ws", "fix", "spec", 2)).toBe("/ws/spec-review-2.json");
});
it("prevHandoffPath: fix.task round1 无专属表项 → 回退 roundR（跨轮次同依赖）", () => {
  expect(prevHandoffPath("/ws", "fix", "task", 1, { tasks: "5" })).toBe(
    "/ws/tasks-5-review-1.json",
  );
  expect(prevHandoffPath("/ws", "fix", "task", 3, { tasks: "1,2" })).toBe(
    "/ws/tasks-1,2-review-3.json",
  );
});
it("resolveWorkspace: spec-design.md 与 plan.md 收敛同 slug workspace", () => {
  // root 显式注入（T3 根注入契约：getRoot() 是模块级单例且无 reset 缝）——不调 initRoot()、不 chdir。
  const specWs = resolveWorkspace(
    "/repo/docs/osuperpowers/specs/2026-09-08-foo-design.md",
    "/repo",
  );
  const planWs = resolveWorkspace("/repo/docs/osuperpowers/plans/2026-09-08-foo.md", "/repo");
  expect(specWs).toBe("/repo/.osuperpowers/cdd/2026-09-08-foo");
  expect(planWs).toBe(specWs);
});
it("resolveWorkspace: 无 root 注入 → throw root required（旧路径形状派生已删）", () => {
  // 改造前单参调用按**路径形状**派生 root（下列两条因形状非 canonical 而抛 `not in a git repo`）；
  // 改造后 root 全由调用方注入，单参（root === undefined）一律抛 `root required` —— 正则不匹配即红。
  expect(() => resolveWorkspace("/repo/.osuperpowers/cdd/x/review-1.json")).toThrow(
    /root required/,
  );
  expect(() => resolveWorkspace("/repo/docs/osuperpowers/notes/x-design.md")).toThrow(
    /root required/,
  );
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
