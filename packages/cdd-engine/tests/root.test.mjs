import { describe, it, expect } from "vitest";
import { execaSync } from "execa";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CDD_MJS = path.resolve(import.meta.dirname, "../bin/cdd.mjs");

describe("lib/root.mjs — 单根权威", () => {
  it("非 git 目录 → CDD_BLOCKED + exit 1", () => {
    const bare = mkdtempSync(path.join(tmpdir(), "cdd-nogit-"));
    const r = execaSync(process.execPath, [CDD_MJS, "review", "--type", "spec", "--spec", "x.md"], {
      cwd: bare, env: { PATH: process.env.PATH, CLAUDE_CODE_SESSION_ID: "1" }, reject: false, encoding: "utf8",
    });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/CDD_BLOCKED: not in a git repository/);
  });

  it("非 git 目录 + cdd --help → exit 0（§2.4.2 退出码表：0 = OK 含 --help）", () => {
    const bare = mkdtempSync(path.join(tmpdir(), "cdd-nogit-help-"));
    const r = execaSync(process.execPath, [CDD_MJS, "--help"], {
      cwd: bare, env: { PATH: process.env.PATH, CLAUDE_CODE_SESSION_ID: "1" }, reject: false, encoding: "utf8",
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Usage: cdd/);
    expect(r.stderr).not.toMatch(/not in a git repository/);
  });
});
