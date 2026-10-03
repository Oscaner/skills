import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execaSync } from "execa";
import { describe, expect, it } from "vitest";

import { gitCommit, gitInit } from "./helpers.ts";

const CDD_TS = path.resolve(import.meta.dirname, "../../bin.ts");
const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

describe("src/infra/root.ts — 单根权威", () => {
  it("非 git 目录 → CDD_BLOCKED + exit 1", () => {
    const bare = mkdtempSync(path.join(tmpdir(), "cdd-nogit-"));
    const r = execaSync(process.execPath, [CDD_TS, "review", "--type", "spec", "--spec", "x.md"], {
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
    const r = execaSync(process.execPath, [CDD_TS, "--help"], {
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

describe("src/infra/root.ts — resolveDocArg single-coordinate system (repo-root relative normalization)", () => {
  it("subdir cwd + repo-root relative --spec → resolution still hits the repo root (cwd-relative fallback exits 1)", () => {
    // Self-contained: a real mkdtemp git repo + a real doc file. Must NOT assert
    // `REPO_ROOT/.kairos/...` — `.kairos` is gitignored and absent on a fresh clone / CI.
    //
    // This case asserts only exit 0, with no "no phantom root" landing assertion (T2 review nit):
    // on the dry-run path runDocsTask exits early at `if (dryRun) return`, resolveNextRound only
    // reads and never creates (ENOENT → round 1), so no code ever creates this workspace — a
    // `!existsSync(<sub>/.kairos)` assertion is a zero-failability false-green source and was
    // deleted. What really fails this case: falling back the repo-root relative path to a
    // cwd-relative one makes `path.join(<sub>, "docs/...")` missing → resolveDocArg exits 1 (while
    // the repo-root relative form exits 0). The landing face (workspace entities created under the
    // repo root, zero landings under subdirs) is carried by the non-dry-run path:
    // `cdd.test.mjs`'s PATH-shim blackbox cases (asserting real `.kairos/cdd/plan/branch-review-*.json`
    // disk writes) and `progress-owner.test.mjs` (injected root + real repo, asserting
    // `<repo>/.kairos/…` products).
    const repo = mkdtempSync(path.join(tmpdir(), "cdd-subdir-"));
    gitInit(repo);
    const rel = "docs/kairos/specs/2026-09-13-foo-design.md";
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, rel), "# foo design\n");
    const sub = path.join(repo, "packages/cdd-engine");
    mkdirSync(sub, { recursive: true });
    // The dispatch entry gate (pre-commit clean tree) runs before docs review — in-repo fixtures
    // must already be committed, otherwise a dirty start is BLOCKED (exit 1) before the test can
    // exercise the cwd-coordinate normalization (Task 8).
    gitCommit(repo);
    const r = execaSync(
      process.execPath,
      [CDD_TS, "--dry-run", "review", "--type", "spec", "--spec", rel],
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
      [CDD_TS, "review", "--type", "spec", "--spec", "docs/nope.md"],
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
    const r = execaSync(process.execPath, [CDD_TS, "review", "--type", "spec", "--spec", abs], {
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
