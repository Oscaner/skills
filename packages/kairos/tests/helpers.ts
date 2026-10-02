// packages/kairos/tests/helpers.ts — shared helpers for behavior/integration tests (Node port
// of test-lib.sh `harness_free_path` + cdd-commit-gate-smoke.sh `setup_repo`).
//
// Distinct layer from the engine module unit tests (their helpers are inline): this file serves
// the behavior/integration test tree under packages/kairos/tests/ (bash boundary tests).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// C8/C7: the harness data lives in the engine harness contract (config/harness-contract.json) —
// the row `cli` fields are what the free-path filter must drop from PATH.
const REG_PATH = path.resolve(HERE, "../../cdd-engine/config/harness-contract.json");

// harness_free_path — drop every PATH directory that contains a registry CLI binary, so the
// host's real CLIs (claude/cursor-agent/droid/pi/codex/...) cannot leak through a mock-PATH
// scenario. Reads the real registry + process.env.PATH by default; registryPath / pathValue
// overrides match the inline versions' semantics.
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

// setup_repo — a fresh git repo whose tracked .gitignore ignores cdd/ (the workspace dir,
// mirroring a real repo: fixture files live under cdd/ without dirtying the tracked tree).
// Returns the repo's absolute path.
export function setupRepo({ prefix = "cdd-behavior-" } = {}) {
  const dest = mkdtempSync(path.join(tmpdir(), prefix));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(
    dest,
    "-c",
    "user.name=cdd-gate-test",
    "-c",
    "user.email=cdd-gate-test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  );
  return dest;
}

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}
