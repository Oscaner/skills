import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import getChangesets from "@changesets/read";
import changelogFunctions from "@changesets/changelog-github";
import {
  computeNextVersion,
  parseRouterVersion,
  computeNextIndependentVersion,
  highestBumpLevel,
  changesetsForPlugin,
} from "./lib/version-utils.mjs";

const root = process.cwd();
const changesetDir = join(root, ".changeset");

// ---- CLI 参数（修复 footgun：此前未知参数被静默忽略并真执行） ----
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const unknownArgs = args.filter((a) => a !== "--dry-run");
if (unknownArgs.length > 0) {
  process.stderr.write(`usage: version-packages.mjs [--dry-run]\n`);
  process.stderr.write(`unknown argument(s): ${unknownArgs.join(", ")}\n`);
  process.exit(1);
}

const changesets = await getChangesets(root);
if (changesets.length === 0) {
  console.log("No changesets — skip version");
  process.exit(0);
}

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const writeJson = (rel, data) => {
  if (DRY) {
    console.log(`  [dry-run] write ${rel}: version → ${data.version}`);
    return;
  }
  writeFileSync(join(root, rel), JSON.stringify(data, null, 2) + "\n");
};

/** Prepend a new release entry under a fixed header, preserving the rest. */
function prependChangelog(header, entry, changelogPath) {
  if (DRY) {
    console.log(`  [dry-run] prepend changelog ${changelogPath.replace(`${root}/`, "")}:`);
    console.log((header + entry).trimEnd());
    console.log("");
    return;
  }
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
const overridesParsed = parseRouterVersion(overridesPkg.version);
const overridesBaseReset =
  overridesParsed !== null && overridesParsed.base !== superpowersVersion;
const overridesNext = !existsSync(overridesChangelogPath)
  ? `${superpowersVersion}-router.0.0.0`
  : computeNextVersion(overridesPkg.version, superpowersVersion);

// Bump overrides only when it has changesets, or the superpowers base moved
// (realignment release). An osuperpowers-only changeset must not produce an
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

// ---- osuperpowers (independent semver) ----
const osuperpowersPkgPath = "packages/osuperpowers/package.json";
const osuperpowersChangelogPath = join(root, "packages/osuperpowers/CHANGELOG.md");
const osuperpowersCS = changesetsForPlugin(
  changesets,
  "@oscaner-skills/osuperpowers",
);
if (osuperpowersCS.length > 0) {
  const osuperpowersPkg = readJson(osuperpowersPkgPath);
  const osuperpowersTypes = osuperpowersCS.map(
    (cs) => cs.releases.find((r) => r.name === "@oscaner-skills/osuperpowers").type,
  );
  const bumpLevel = highestBumpLevel(osuperpowersTypes);
  const osuperpowersNext = computeNextIndependentVersion(osuperpowersPkg.version, bumpLevel);

  const sections = [];
  for (const type of ["major", "minor", "patch"]) {
    const typed = osuperpowersCS.filter(
      (cs) =>
        cs.releases.find((r) => r.name === "@oscaner-skills/osuperpowers").type ===
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
  const osuperpowersHeader = "# osuperpowers\n\n";
  const osuperpowersEntry = `## ${osuperpowersNext}\n\n${sections.join("")}`;
  prependChangelog(osuperpowersHeader, osuperpowersEntry, osuperpowersChangelogPath);

  osuperpowersPkg.version = osuperpowersNext;
  writeJson(osuperpowersPkgPath, osuperpowersPkg);

  // Sync osuperpowers version to the init self-check stamps (the only SOTs
  // outside package.json). SKILL.md holds the version marker; router.md's
  // written-table template carries the same stamp for `init router`. Both must
  // exist or the release aborts. marketplace/source.json and the per-harness
  // manifests are derived emit products — the emit that
  // sync-router-versions.mjs runs below re-derives them from package.json,
  // so no direct source.json write.
  for (const initPath of [
    "packages/osuperpowers/skills/init/SKILL.md",
    "packages/osuperpowers/skills/init/router.md",
  ]) {
    const init = readFileSync(join(root, initPath), "utf8");
    const stamped = init.replace(
      /<!-- osuperpowers-version: [^ ]+ -->/,
      `<!-- osuperpowers-version: ${osuperpowersNext} -->`,
    );
    if (stamped === init) {
      throw new Error(`${initPath} missing osuperpowers-version stamp`);
    }
    if (DRY) {
      console.log(`  [dry-run] stamp ${initPath} → osuperpowers-version ${osuperpowersNext}`);
      continue;
    }
    writeFileSync(join(root, initPath), stamped);
  }
}

// ---- record which plugins were actually versioned (release workflow) ----
// release.yml's per-plugin matrix job reads this to skip plugins that had no
// changesets — otherwise it would mint a phantom baseline tag/release for
// osuperpowers@0.1.0 on the first publish. Written under .changeset/ so the
// Version PR commits it alongside the version bumps; it persists into the
// publish-mode push that follows the Version PR merge.
const versioned = [];
if (overridesCS.length > 0 || overridesBaseReset) {
  versioned.push("osuperpowers-router");
}
if (osuperpowersCS.length > 0) {
  versioned.push("osuperpowers");
}
if (DRY) {
  console.log(`  [dry-run] write .changeset/versioned-plugins.json: ${versioned.join(", ")}`);
} else {
  writeFileSync(
    join(root, ".changeset/versioned-plugins.json"),
    JSON.stringify(versioned, null, 2) + "\n",
  );
}

// ---- cleanup consumed changesets ----
if (DRY) {
  const consumed = changesets.map((cs) => `${cs.id}.md`).join(", ");
  console.log(`  [dry-run] would consume changesets: ${consumed}`);
} else {
  for (const cs of changesets) {
    unlinkSync(join(changesetDir, `${cs.id}.md`));
  }
}

// ---- sync overrides version + regenerate marketplace emits ----
// Runs after both plugin versions are written so the emit resolves
// source.json against the freshly bumped package.json versions.
if (DRY) {
  console.log("  [dry-run] would run sync-router-versions.mjs (re-derive marketplace + manifests)");
} else {
  execSync("node scripts/sync-router-versions.mjs", {
    stdio: "inherit",
    cwd: root,
  });
}

console.log(DRY ? "OK — would version (dry-run, nothing written)" : "OK — versioned");
