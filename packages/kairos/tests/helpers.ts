// packages/kairos/tests/helpers.ts — shared helpers for behavior/integration tests (Node port
// of test-lib.sh `harness_free_path` + cdd-commit-gate-smoke.sh `setup_repo`).
//
// Distinct layer from the engine module unit tests (their helpers are inline): this file serves
// the behavior/integration test tree under packages/kairos/tests/ (bash boundary tests).
//
// Zero module-level bare functions — the helpers are `const` arrows (the P5 zero-
// `function`-declaration discipline applies to this migrated surface too).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SKILL_ANATOMY } from "../../cdd-engine/src-next/contract/skill-anatomy.ts";
import { HOSTS } from "../../cdd-engine/src-next/face/host.ts";

// ---------------------------------------------------------------------------
// the kairos skills-count single truth (the P5 validation-domicile closure
// re-homed this from the root guard plane — the pi-package consumers own it)
// ---------------------------------------------------------------------------

/** "A skill = a directory containing SKILL.md" — the shared count definition the
 *  pi-package tests (pi-package.test.ts · pi-install-smoke.test.ts) consume; a
 *  definition change needs this one edit only. */
export const countSkillsWithMarkdown = (dir: string): number => {
  return readdirSync(dir, { withFileTypes: true }).filter(
    (e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md")),
  ).length;
};

/** The authoritative kairos skills count — the closed six-set's cardinality from the
 *  typed skill-anatomy roster (never a local literal); shared by the pi-package
 *  tests (a definition change is a roster edit). */
export const EXPECTED = Object.keys(SKILL_ANATOMY.skills.registry).length;

// T21: the harness data lives in the engine's typed host contract (src-next/face/host.ts) — the
// row `cli` fields are what the free-path filter must drop from PATH (the new data plane's home;
// the old config-dir JSON is retired from this plane).

// harness_free_path — drop every PATH directory that contains a registry CLI binary, so the
// host's real CLIs (claude/cursor-agent/droid/pi/codex/...) cannot leak through a mock-PATH
// scenario. Reads the real registry + process.env.PATH by default; pathValue / cliOverride
// overrides match the inline versions' semantics.
export const harnessFreePath = ({
  cliValues = Object.values(HOSTS).map((row) => row.cli),
  pathValue = process.env.PATH,
}: {
  cliValues?: readonly string[];
  pathValue?: string;
} = {}) => {
  const clis = cliValues.filter((b): b is string => Boolean(b));
  // PATH is always set under Node; the guard mirrors the old `.split` crash if it is not.
  if (pathValue === undefined) throw new Error("PATH is not set");
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
};

// setup_repo — a fresh git repo whose tracked .gitignore ignores cdd/ (the workspace dir,
// mirroring a real repo: fixture files live under cdd/ without dirtying the tracked tree).
// Returns the repo's absolute path.
export const setupRepo = ({ prefix = "cdd-behavior-" } = {}) => {
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
};

const git = (repo: string, ...args: string[]): string => {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
};
