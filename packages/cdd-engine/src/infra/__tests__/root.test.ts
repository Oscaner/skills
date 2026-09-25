import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execaSync } from "execa";
import { describe, expect, it } from "vitest";

import { gitCommit, gitInit } from "./helpers.ts";

const CDD_MJS = path.resolve(import.meta.dirname, "../../../dist/cli.mjs");
const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

describe("src/infra/root.ts — 单根权威", () => {
  it("非 git 目录 → CDD_BLOCKED + exit 1", () => {
    const bare = mkdtempSync(path.join(tmpdir(), "cdd-nogit-"));
    const r = execaSync(process.execPath, [CDD_MJS, "review", "--type", "spec", "--spec", "x.md"], {
      cwd: bare,
      env: { PATH: process.env.PATH, CLAUDE_CODE_SESSION_ID: "1" },
      reject: false,
      encoding: "utf8",
    });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/CDD_BLOCKED: not in a git repository/);
  });

  it("非 git 目录 + cdd --help → exit 0（§2.4.2 退出码表：0 = OK 含 --help）", () => {
    const bare = mkdtempSync(path.join(tmpdir(), "cdd-nogit-help-"));
    const r = execaSync(process.execPath, [CDD_MJS, "--help"], {
      cwd: bare,
      env: { PATH: process.env.PATH, CLAUDE_CODE_SESSION_ID: "1" },
      reject: false,
      encoding: "utf8",
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/USAGE cdd/);
    expect(r.stderr).not.toMatch(/not in a git repository/);
  });
});

describe("src/infra/root.ts — resolveDocArg 单一坐标系（仓根相对归一）", () => {
  it("子目录 cwd + 仓根相对 --spec → 归一仍命中仓根（cwd 相对回落即 exit 1）", () => {
    // 自给自足：mkdtemp 真 git 仓 + 真 doc 文件。**不得**断言 `REPO_ROOT/.osuperpowers/...`——
    // `.osuperpowers` 被 `.gitignore` 忽略，fresh clone / CI 上不存在。
    //
    // **本用例只断言 exit 0，不设「无幽灵根」落点断言**（T2 review nit）：dry-run 路径下
    // runDocsTask 在 `if (dryRun) return` 处早退、resolveNextRound 只读不建（ENOENT 归 round 1），
    // **没有任何代码会创建该 workspace**——故 `!existsSync(<sub>/.osuperpowers)` 在改造前后恒真，
    // 是可失败性为零的假绿源，已删除。真正可失败的是本断言：把仓根相对回落成 cwd 相对时
    // `path.join(<sub>, "docs/...")` 不存在 → resolveDocArg exit 1（而仓根相对 → exit 0）。
    // 落点（workspace 实体创建在仓根、子目录下零落点）由非 dry-run 路径承担：
    // `cdd.test.mjs` 的 PATH-shim 黑盒用例（`.osuperpowers/cdd/plan/branch-review-*.json` 真实落盘断言）
    // 与 `progress-owner.test.mjs`（注入 root + 真仓，断言 `<repo>/.osuperpowers/…` 产物）。
    const repo = mkdtempSync(path.join(tmpdir(), "cdd-subdir-"));
    gitInit(repo);
    const rel = "docs/osuperpowers/specs/2026-09-13-foo-design.md";
    mkdirSync(path.join(repo, "docs/osuperpowers/specs"), { recursive: true });
    writeFileSync(path.join(repo, rel), "# foo design\n");
    const sub = path.join(repo, "packages/cdd-engine");
    mkdirSync(sub, { recursive: true });
    // The dispatch entry gate (pre-commit clean tree) runs before docs review — in-repo fixtures
    // must already be committed, otherwise a dirty start is BLOCKED (exit 1) before the test can
    // exercise the cwd-coordinate normalization (Task 8).
    gitCommit(repo);
    const r = execaSync(
      process.execPath,
      [CDD_MJS, "--dry-run", "review", "--type", "spec", "--spec", rel],
      {
        cwd: sub,
        env: { PATH: process.env.PATH, CLAUDE_CODE_SESSION_ID: "1" },
        reject: false,
        encoding: "utf8",
      },
    );
    expect(r.exitCode).toBe(0);
  });

  it("不存在的仓根相对路径 → exit 1 + BLOCKED 三行诊断（含仓根相对指导）", () => {
    const r = execaSync(
      process.execPath,
      [CDD_MJS, "review", "--type", "spec", "--spec", "docs/nope.md"],
      {
        cwd: REPO_ROOT,
        env: { PATH: process.env.PATH, CLAUDE_CODE_SESSION_ID: "1" },
        reject: false,
        encoding: "utf8",
      },
    );
    expect(r.exitCode).toBe(1); // §2.4.2: 1 = runtime cannot continue (**not** 2)
    expect(r.stderr.trimEnd().split("\n").length).toBe(3); // three-line diagnosis (the line count is a distinguishing shape, not a tautological assertion)
    expect(r.stderr).toMatch(/CDD_BLOCKED: --spec not found: docs\/nope\.md/);
    expect(r.stderr).toMatch(/Tried \(against repo root .+\): /);
    expect(r.stderr).toMatch(
      /Hint: cdd resolves paths against the repo root\. Verify the path is correct relative to the repo root\./,
    );
  });

  it("不存在的绝对路径 → exit 1 + BLOCKED 三行诊断（绝对路径形措辞；与相对形可区分）", () => {
    const abs = path.join(REPO_ROOT, "docs/nope-abs.md"); // the negative case of the absolute-path direct-use branch (the second shape of Global Constraints)
    const r = execaSync(process.execPath, [CDD_MJS, "review", "--type", "spec", "--spec", abs], {
      cwd: REPO_ROOT,
      env: { PATH: process.env.PATH, CLAUDE_CODE_SESSION_ID: "1" },
      reject: false,
      encoding: "utf8",
    });
    expect(r.exitCode).toBe(1); // same code as the relative shape (§2.4.2: 1, **not** 2)
    expect(r.stderr.trimEnd().split("\n").length).toBe(3); // both shapes are identically three lines (line-count anchor)
    expect(r.stderr).toMatch(/CDD_BLOCKED: --spec not found: .*nope-abs\.md/); // ① byte-identical to the relative shape
    expect(r.stderr).toMatch(/Absolute path does not exist\./); // ② the absolute-path shape
    expect(r.stderr).toMatch(/Hint: pass a repo-root-relative path instead\./); // ③ the absolute-path shape
    expect(r.stderr).not.toMatch(/Tried \(against repo root/); // the absolute shape must not show a repo-root attempt line (distinguishing shape)
  });
});
