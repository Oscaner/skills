// scripts/validate/version-sync.test.ts — T10: version-sync 读侧【连根】删除 init 版本戳块
//（design §2.6.2 R2 读方 `version-sync.ts:67-79`）。init 目录与版本戳机制整体删除后，读侧脚本
// 不得再出现戳字面 / init 路径——否则就是对该机制的残留引用，且在 init 缺失时会让块 8-10 直接
// readFileSync ENOENT 而红。结构守卫（源文零戳 + 零 init 路径）是本任务「写失败测试（红）」的
// 机械载体；行为信号（块 8-10 连同 `pnpm run validate` 全绿）由 validate 编排收归。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "version-sync.ts");
const src = () => readFileSync(SRC, "utf8");

describe("version-sync：init 版本戳读侧连根删除（T10 / §2.6.2 R2）", () => {
  it("源内零 `osuperpowers-version` 戳字面", () => {
    expect(src()).not.toMatch(/osuperpowers-version/);
  });
  it("源内零 init SKILL.md 路径（不再读已删的 init 目录）", () => {
    expect(src()).not.toMatch(/skills\/init/);
  });
});

describe("version-sync：vendors 自维护读侧连根删除（P6 Task 2 / B8）", () => {
  it("源内零 vendored 读侧（superpowers submodule check 已删——v1.13 flake 消解）", () => {
    // B8: superpowers ↔ marketplace 版本一致性检查删（vendors/superpowers/
    // .claude-plugin/plugin.json 读侧 + 三源等值比较）；version-sync 只校验
    // first-party osuperpowers 版本同步。\b 词界保证 osuperpowers 不误伤。
    expect(src()).not.toMatch(/\bsuperpowers\b|vendors\//);
  });
});
