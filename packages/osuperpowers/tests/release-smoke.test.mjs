// packages/osuperpowers/tests/release-smoke.test.mjs — C6 release npm-path smoke (R5 station ②).
// Structural pin for the release.yml pi-registry smoke step: publish-mode gate, publishedPackages
// version extraction, the --local --approve install path, and the triple assertions (exit 0 /
// installed skills/ count === shared EXPECTED / .pi/settings.json records the package), plus the
// not-published skip contract and the job-level pi assembly. The count assertion is bound to the
// imported EXPECTED export — never a hardcoded literal — so a skills-inventory change fails this
// guard until the release smoke stays consistent with the single source of truth.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import { EXPECTED } from "../../../scripts/validate/osuperpowers.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const RELEASE_YML = path.join(REPO_ROOT, ".github/workflows/release.yml");

const doc = parse(readFileSync(RELEASE_YML, "utf8"));
const releaseJob = doc.jobs.release;
const stepIndex = (step) => releaseJob.steps.indexOf(step);

// Selectors keyed on stable name text (not position, not step numbers).
const changesetsStep = releaseJob.steps.find((s) => s.id === "changesets");
const smokeStep = releaseJob.steps.find((s) => typeof s.name === "string" && s.name.includes("Release smoke"));
const piInstallStep = releaseJob.steps.find((s) => typeof s.name === "string" && s.name.includes("Install pi coding agent"));

const PUBLISH_MODE_GATE = "steps.changesets-status.outputs.has_changesets == 'false'";

test("release job carries the smoke after the changesets action", () => {
  assert.ok(releaseJob, "release job must exist");
  assert.ok(changesetsStep, "changesets/action step (id: changesets) must exist");
  assert.ok(smokeStep, "release smoke step must exist in the release job");
  assert.ok(stepIndex(smokeStep) > stepIndex(changesetsStep), "smoke step must sit after the changesets action");
});

test("smoke gate reuses the publish-mode push gate", () => {
  assert.equal(smokeStep.if, PUBLISH_MODE_GATE, "smoke must reuse the Detect publish-mode push gate");
});

test("smoke reads the published version from publishedPackages by name", () => {
  // The action's v2 step outputs are kebab-case (hard-won at P4.2: has-changesets, not
  // hasChangesets) — the published list output is "published-packages", JSON array of
  // { name, version } entry per published pack.
  assert.equal(
    smokeStep.env?.PUBLISHED_PACKAGES,
    "${{ steps.changesets.outputs.published-packages }}",
    "smoke must read the changesets action published-packages output (v2 kebab-case)",
  );
  assert.match(smokeStep.run, /p\.name === "@oscaner-skills\/osuperpowers"/);
  assert.match(smokeStep.run, /npm:@oscaner-skills\/osuperpowers@\$\{version\}/);
});

test("smoke installs with the measured --local --approve flags", () => {
  assert.match(smokeStep.run, /--local/);
  assert.match(smokeStep.run, /--approve/);
});

test("smoke carries the triple assertion (exit 0 / skills count / settings record)", () => {
  const run = smokeStep.run;
  assert.match(run, /Assertion 1/);
  assert.match(run, /Assertion 2/);
  assert.match(run, /Assertion 3/);
  assert.match(run, /\.pi\/npm\/node_modules\/@oscaner-skills\/osuperpowers\/skills/);
  assert.match(run, /\.pi\/settings\.json/);
});

test("skills count assertion derives from the shared EXPECTED export (no literal)", () => {
  const run = smokeStep.run;
  // The count oracle must be the shared module-level EXPECTED export.
  assert.match(run, /m\.EXPECTED/);
  // The compare must run against the derived value, never a hardcoded count.
  assert.match(run, /\[ "\$count" = "\$expected" \]/);
  assert.doesNotMatch(
    run,
    new RegExp(`-eq ${EXPECTED}\\b`),
    `smoke must not hardcode the current count ${EXPECTED} — it must derive from the shared export`,
  );
});

test("not-published push skips the smoke explicitly (zero install, zero assertion, zero error)", () => {
  const run = smokeStep.run;
  assert.match(run, /-z "\$version"/);
  assert.match(run, /exit 0/, "absent osuperpowers entry must exit 0 without asserting");
  assert.match(run, /zero install, zero assertion, zero error/);
});

test("release job assembles a pi install step pinned to the measured version", () => {
  assert.ok(piInstallStep, "release job must carry a pi install step");
  assert.match(piInstallStep.run, /npm i -g @earendil-works\/pi-coding-agent@0\.87\.1/);
});
