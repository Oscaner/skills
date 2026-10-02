// packages/kairos/tests/pi-install-smoke.test.ts — C4 install smoke (R5 station ①).
// End-to-end consumer path for the pi harness: npm pack (cwd = the package dir) → tar
// extract (strip the npm top-level package/ dir) → temp project cwd → `pi install
// <unpacked-abs-path> --local --approve` → assert the three contract outcomes. The flag
// pin is probe-measured (pi 0.87.1): --local writes the project .pi/settings.json and
// requires --approve (the trust gate — --no-approve + --local exits 1 "Project is not
// trusted"). The landing point is likewise probe-verified: a local directory install
// records the source path in .pi/settings.json and resolves the package in place — no
// artifact copy is materialized, so the unpacked package tree IS the install product and
// its skills/ is the resolution target the count assertion checks. Zero network: local
// pack + local directory install only. Missing pi is a hard FAIL with the install command
// in the message (zero silent skip).

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { countSkillsWithMarkdown, EXPECTED } from "../../../scripts/validate/kairos.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(HERE, "..");
const PI_INSTALL_HINT = "npm i -g @earendil-works/pi-coding-agent";

// Spawn `pi`; a missing binary (ENOENT) becomes an assertion-failing Error whose message
// carries the install command — the zero silent skip contract.
function runPi(args, { cwd, env = process.env } = {}) {
  const result = spawnSync("pi", args, { cwd, env, encoding: "utf8" });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(
        `pi CLI not found on PATH — install it with: ${PI_INSTALL_HINT} (${result.error.message})`,
      );
    }
    throw result.error;
  }
  return result;
}

test("pi install smoke: pack → extract → pi install <dir> --local --approve", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "pi-install-smoke-"));
  try {
    // 1. npm pack from the package dir into a temp destination — the tarball name carries
    // the package version, so locate it dynamically (no version literal).
    const packDir = path.join(workspace, "pack");
    mkdirSync(packDir);
    execFileSync("npm", ["pack", "--pack-destination", packDir], {
      cwd: PKG_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const tarballs = readdirSync(packDir).filter((f) => f.endsWith(".tgz"));
    assert.strictEqual(
      tarballs.length,
      1,
      `expected exactly one packed tarball, got: ${tarballs.join(", ")}`,
    );
    const tarball = path.join(packDir, tarballs[0]);

    // 2. Extract, stripping the npm top-level package/ directory.
    const unpacked = path.join(workspace, "unpacked");
    mkdirSync(unpacked);
    execFileSync("tar", ["-xzf", tarball, "-C", unpacked, "--strip-components=1"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    // 3. Install-product skills assertion: pi resolves local directory installs in place
    // (probe-measured landing), so the unpacked package's skills/ is the customer-visible
    // artifact; its SKILL.md count uses the shared countSkillsWithMarkdown + module-level
    // EXPECTED truth (no literal 8).
    const skillsDir = path.join(unpacked, "skills");
    assert.ok(existsSync(skillsDir), "unpacked package must carry skills/");
    assert.strictEqual(
      countSkillsWithMarkdown(skillsDir),
      EXPECTED,
      `unpacked package skills/ must carry exactly EXPECTED SKILL.md`,
    );

    // 4. Temp project cwd → pi install <abs-dir> --local --approve.
    const project = path.join(workspace, "project");
    mkdirSync(project);
    const install = runPi(["install", unpacked, "--local", "--approve"], { cwd: project });
    assert.strictEqual(install.status, 0, `pi install exited ${install.status}: ${install.stderr}`);

    // 5. The project .pi/settings.json records the installed package source — path.resolve
    // normalizes the recorded entry back to the unpacked dir. The recorded form is runtime-
    // dependent (probe-measured on pi 0.87.1, cross-platform): absolute (macOS probe) or a
    // path relative to the settings file's own directory (Linux CI: "../../unpacked" with the
    // settings file under <project>/.pi/settings.json) — so resolution anchors on
    // path.dirname(settingsPath), the one base both forms share.
    const settingsPath = path.join(project, ".pi", "settings.json");
    assert.ok(
      existsSync(settingsPath),
      "project .pi/settings.json must exist after a --local install",
    );
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    const recorded = Array.isArray(settings.packages) ? settings.packages : [];
    assert.ok(
      recorded.some(
        (entry) =>
          typeof entry === "string" && path.resolve(path.dirname(settingsPath), entry) === unpacked,
      ),
      `settings.json packages must record the installed source, got: ${JSON.stringify(recorded)}`,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("missing pi binary fails with the install command (zero silent skip)", () => {
  const strippedEnv = { ...process.env, PATH: "/nonexistent-pi-smoke-path" };
  assert.throws(
    () => runPi(["--version"], { env: strippedEnv }),
    (err) => err instanceof Error && err.message.includes(PI_INSTALL_HINT),
  );
});
