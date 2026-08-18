import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import getChangesets from "@changesets/read";
import changelogFunctions from "@changesets/changelog-github";
import {
  computeNextVersion,
  parseOverridesVersion,
  computeNextIndependentVersion,
  highestBumpLevel,
  changesetsForPlugin,
} from "./lib/version-utils.mjs";

const root = process.cwd();
const changesetDir = join(root, ".changeset");

const changesets = await getChangesets(root);
if (changesets.length === 0) {
  console.log("No changesets — skip version");
  process.exit(0);
}

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const writeJson = (rel, data) =>
  writeFileSync(join(root, rel), JSON.stringify(data, null, 2) + "\n");

/** Prepend a new release entry under a fixed header, preserving the rest. */
function prependChangelog(header, entry, changelogPath) {
  if (!existsSync(changelogPath)) {
    writeFileSync(changelogPath, header + entry);
    return;
  }
  const existing = readFileSync(changelogPath, "utf8");
  if (!existing.startsWith(header)) {
    throw new Error("Unexpected CHANGELOG format");
  }
  writeFileSync(changelogPath, header + entry + existing.slice(header.length));
}

const marketplace = readJson("marketplace/source.json");
const superpowersVersion = marketplace.plugins.find(
  (p) => p.name === "superpowers",
)?.version;
if (!superpowersVersion) {
  throw new Error("superpowers plugin not found in marketplace/source.json");
}

const changelogOptions = { repo: "Oscaner/skills" };

// ---- osuperpowers-router (superpowers-relative scheme) ----
const overridesPkgPath = "packages/osuperpowers-router/package.json";
const overridesChangelogPath = join(
  root,
  "packages/osuperpowers-router/CHANGELOG.md",
);
const overridesCS = changesetsForPlugin(
  changesets,
  "@oscaner-skills/osuperpowers-router",
);
const overridesPkg = readJson(overridesPkgPath);
const overridesParsed = parseOverridesVersion(overridesPkg.version);
const overridesBaseReset =
  overridesParsed !== null && overridesParsed.base !== superpowersVersion;
const overridesNext = !existsSync(overridesChangelogPath)
  ? `${superpowersVersion}-overrides.0.0.0`
  : computeNextVersion(overridesPkg.version, superpowersVersion);

// Bump overrides only when it has changesets, or the superpowers base moved
// (realignment release). An engineering-only changeset must not produce an
// empty overrides release.
if (overridesCS.length > 0 || overridesBaseReset) {
  const releaseLines = [];
  if (overridesBaseReset) {
    releaseLines.push(`\n- Align with superpowers ${superpowersVersion}`);
  }
  for (const cs of overridesCS) {
    if (overridesBaseReset && cs.id.startsWith("auto-align-")) continue;
    releaseLines.push(
      await changelogFunctions.getReleaseLine(cs, "patch", changelogOptions),
    );
  }
  const overridesHeader = "# osuperpowers-router\n\n";
  const overridesEntry = `## ${overridesNext}\n\n### Patch Changes${releaseLines.join("")}\n\n`;
  prependChangelog(overridesHeader, overridesEntry, overridesChangelogPath);
  overridesPkg.version = overridesNext;
  writeJson(overridesPkgPath, overridesPkg);
}

// ---- engineering (independent semver) ----
const osengPkgPath = "packages/osuperpowers/package.json";
const osengChangelogPath = join(root, "packages/osuperpowers/CHANGELOG.md");
const osengCS = changesetsForPlugin(
  changesets,
  "@oscaner-skills/engineering",
);
if (osengCS.length > 0) {
  const osengPkg = readJson(osengPkgPath);
  const osengTypes = osengCS.map(
    (cs) => cs.releases.find((r) => r.name === "@oscaner-skills/engineering").type,
  );
  const bumpLevel = highestBumpLevel(osengTypes);
  const osengNext = computeNextIndependentVersion(osengPkg.version, bumpLevel);

  const sections = [];
  for (const type of ["major", "minor", "patch"]) {
    const typed = osengCS.filter(
      (cs) =>
        cs.releases.find((r) => r.name === "@oscaner-skills/engineering").type ===
        type,
    );
    if (typed.length === 0) continue;
    const lines = [];
    for (const cs of typed) {
      lines.push(
        await changelogFunctions.getReleaseLine(cs, type, changelogOptions),
      );
    }
    const title = `${type[0].toUpperCase()}${type.slice(1)} Changes`;
    sections.push(`### ${title}${lines.join("")}\n\n`);
  }
  const osengHeader = "# osuperpowers\n\n";
  const osengEntry = `## ${osengNext}\n\n${sections.join("")}`;
  prependChangelog(osengHeader, osengEntry, osengChangelogPath);

  osengPkg.version = osengNext;
  writeJson(osengPkgPath, osengPkg);

  // Sync engineering version to the os-init self-check stamps (the only SOTs
  // outside package.json). SKILL.md holds the version marker; spor.md's
  // written-table template carries the same stamp for `os-init spor`. Both must
  // exist or the release aborts. marketplace/source.json and the per-harness
  // manifests are derived emit products — the emit that
  // sync-overrides-versions.mjs runs below re-derives them from package.json,
  // so no direct source.json write.
  for (const initPath of [
    "packages/osuperpowers/skills/os-init/SKILL.md",
    "packages/osuperpowers/skills/os-init/spor.md",
  ]) {
    const init = readFileSync(join(root, initPath), "utf8");
    const stamped = init.replace(
      /<!-- engineering-version: [^ ]+ -->/,
      `<!-- engineering-version: ${osengNext} -->`,
    );
    if (stamped === init) {
      throw new Error(`${initPath} missing engineering-version stamp`);
    }
    writeFileSync(join(root, initPath), stamped);
  }
}

// ---- record which plugins were actually versioned (release workflow) ----
// release.yml's per-plugin matrix job reads this to skip plugins that had no
// changesets — otherwise it would mint a phantom baseline tag/release for
// engineering@0.1.0 on the first publish. Written under .changeset/ so the
// Version PR commits it alongside the version bumps; it persists into the
// publish-mode push that follows the Version PR merge.
const versioned = [];
if (overridesCS.length > 0 || overridesBaseReset) {
  versioned.push("osuperpowers-router");
}
if (osengCS.length > 0) {
  versioned.push("osuperpowers");
}
writeFileSync(
  join(root, ".changeset/versioned-plugins.json"),
  JSON.stringify(versioned, null, 2) + "\n",
);

// ---- cleanup consumed changesets ----
for (const cs of changesets) {
  unlinkSync(join(changesetDir, `${cs.id}.md`));
}

// ---- sync overrides version + regenerate marketplace emits ----
// Runs after both plugin versions are written so the emit resolves
// source.json against the freshly bumped package.json versions.
execSync("node scripts/sync-overrides-versions.mjs", {
  stdio: "inherit",
  cwd: root,
});

console.log("OK — versioned");
