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

const marketplace = readJson("marketplace/source.json");
const superpowersVersion = marketplace.plugins.find(
  (p) => p.name === "superpowers",
)?.version;
if (!superpowersVersion) {
  throw new Error("superpowers plugin not found in marketplace/source.json");
}

const changelogOptions = { repo: "Oscaner/skills" };

// ---- superpowers-overrides (superpowers-relative scheme) ----
const overridesPkgPath = "plugins/superpowers-overrides/package.json";
const overridesChangelogPath = join(
  root,
  "plugins/superpowers-overrides/CHANGELOG.md",
);
const overridesCS = changesetsForPlugin(changesets, "superpowers-overrides");
const overridesPkg = readJson(overridesPkgPath);
const overridesParsed = parseOverridesVersion(overridesPkg.version);
const overridesBaseReset =
  overridesParsed !== null && overridesParsed.base !== superpowersVersion;
const overridesNext = !existsSync(overridesChangelogPath)
  ? `${superpowersVersion}-overrides.0.0.0`
  : computeNextVersion(overridesPkg.version, superpowersVersion);

// Bump overrides only when it has changesets, or the superpowers base moved
// (realignment release). An os-engineering-only changeset must not produce an
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
  const overridesHeader = "# superpowers-overrides\n\n";
  const overridesEntry = `## ${overridesNext}\n\n### Patch Changes${releaseLines.join("")}\n\n`;
  if (!existsSync(overridesChangelogPath)) {
    writeFileSync(overridesChangelogPath, overridesHeader + overridesEntry);
  } else {
    const existing = readFileSync(overridesChangelogPath, "utf8");
    if (!existing.startsWith(overridesHeader)) {
      throw new Error("Unexpected CHANGELOG format");
    }
    writeFileSync(
      overridesChangelogPath,
      overridesHeader + overridesEntry + existing.slice(overridesHeader.length),
    );
  }
  overridesPkg.version = overridesNext;
  writeJson(overridesPkgPath, overridesPkg);
}

// ---- os-engineering (independent semver) ----
const osengPkgPath = "plugins/os-engineering/package.json";
const osengChangelogPath = join(root, "plugins/os-engineering/CHANGELOG.md");
const osengCS = changesetsForPlugin(changesets, "os-engineering");
if (osengCS.length > 0) {
  const osengPkg = readJson(osengPkgPath);
  const osengTypes = osengCS.map(
    (cs) => cs.releases.find((r) => r.name === "os-engineering").type,
  );
  const bumpLevel = highestBumpLevel(osengTypes);
  const osengNext = computeNextIndependentVersion(osengPkg.version, bumpLevel);

  const sections = [];
  for (const type of ["major", "minor", "patch"]) {
    const typed = osengCS.filter(
      (cs) => cs.releases.find((r) => r.name === "os-engineering").type === type,
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
  const osengHeader = "# os-engineering\n\n";
  const osengEntry = `## ${osengNext}\n\n${sections.join("")}`;
  if (!existsSync(osengChangelogPath)) {
    writeFileSync(osengChangelogPath, osengHeader + osengEntry);
  } else {
    const existing = readFileSync(osengChangelogPath, "utf8");
    if (!existing.startsWith(osengHeader)) {
      throw new Error("Unexpected CHANGELOG format");
    }
    writeFileSync(
      osengChangelogPath,
      osengHeader + osengEntry + existing.slice(osengHeader.length),
    );
  }

  osengPkg.version = osengNext;
  writeJson(osengPkgPath, osengPkg);

  // Sync os-engineering version to the SOT locations: marketplace/source.json
  // and the os-init self-check stamp. The per-harness manifests are generated
  // (gitignored) — the emit at the end of this script re-stamps them from
  // package.json.
  const sourcePath = "marketplace/source.json";
  const source = readJson(sourcePath);
  const entry = source.plugins.find((p) => p.name === "os-engineering");
  if (!entry) throw new Error("os-engineering not in marketplace/source.json");
  entry.version = osengNext;
  writeJson(sourcePath, source);

  const initPath = "plugins/os-engineering/skills/os-init/SKILL.md";
  const init = readFileSync(join(root, initPath), "utf8");
  const stamped = init.replace(
    /<!-- os-engineering-version: [^ ]+ -->/,
    `<!-- os-engineering-version: ${osengNext} -->`,
  );
  if (stamped === init) {
    throw new Error("os-init SKILL.md missing os-engineering-version stamp");
  }
  writeFileSync(join(root, initPath), stamped);
}

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
