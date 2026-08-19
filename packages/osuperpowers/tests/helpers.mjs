// packages/osuperpowers/tests/helpers.mjs — 行为/集成测试共享帮手（Node port of test-lib.sh
// `harness_free_path` + cdd-commit-gate-smoke.sh `setup_repo` fixture）。
//
// 与 bin/engine/tests/（模块单测，各自的 helpers 内联）分属两层：本文件服务
// packages/osuperpowers/tests/ 的行为/集成测试树（bash 边界测试）。
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REG_PATH = path.resolve(HERE, "../bin/engine/harness-registry.json");

// harness_free_path（test-lib.sh）—— 丢弃每个含 registry CLI 二进制的 PATH 目录，使
// 宿主真实 CLI（claude/cursor-agent/droid/pi/codex/...）无法穿透 mock-PATH 场景泄漏。
// 默认读真实 registry + process.env.PATH；可传 registryPath / pathValue 覆盖（对齐
// exec.test.mjs / select.test.mjs 的内联版语义）。
export function harnessFreePath({ registryPath = REG_PATH, pathValue = process.env.PATH } = {}) {
  const reg = JSON.parse(readFileSync(registryPath, "utf8"));
  const clis = Object.values(reg)
    .map((e) => e.cli)
    .filter(Boolean);
  return pathValue
    .split(path.delimiter)
    .filter((d) => {
      if (!d) return false;
      return !clis.some((b) => {
        try {
          const st = statSync(path.join(d, b));
          return st.isFile() && (st.mode & 0o111) !== 0;
        } catch {
          return false;
        }
      });
    })
    .join(path.delimiter);
}

// setup_repo（cdd-commit-gate-smoke.sh）—— 新 git repo，tracked .gitignore 忽略 cdd/
// （workspace 目录，镜像真实 repo：fixture 文件放 cdd/ 下不弄脏 tracked tree）。
// 返回 repo 绝对路径。
export function setupRepo({ prefix = "cdd-behavior-" } = {}) {
  const dest = mkdtempSync(path.join(tmpdir(), prefix));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(dest, "-c", "user.name=cdd-gate-test", "-c", "user.email=cdd-gate-test@example.com", "commit", "--allow-empty", "-qm", "fixture");
  return dest;
}

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}
