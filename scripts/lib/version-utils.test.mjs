import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseSemver,
  computeNextIndependentVersion,
  highestBumpLevel,
  changesetsForPlugin,
} from "./version-utils.mjs";

describe("parseSemver", () => {
  it("parses plain semver", () => {
    assert.deepEqual(parseSemver("0.1.0"), {
      major: 0,
      minor: 1,
      patch: 0,
    });
  });

  it("rejects non-version strings", () => {
    assert.equal(parseSemver("not-a-version"), null);
  });
});

describe("computeNextIndependentVersion", () => {
  it("increments patch", () => {
    assert.equal(computeNextIndependentVersion("0.1.0", "patch"), "0.1.1");
  });

  it("increments minor and resets patch", () => {
    assert.equal(computeNextIndependentVersion("0.1.3", "minor"), "0.2.0");
  });

  it("increments major and resets minor+patch", () => {
    assert.equal(computeNextIndependentVersion("0.9.7", "major"), "1.0.0");
  });

  it("throws on invalid current version", () => {
    assert.throws(() => computeNextIndependentVersion("bad", "patch"), /Invalid semver/);
  });

  it("throws on unknown bump level", () => {
    assert.throws(() => computeNextIndependentVersion("0.1.0", "none"), /Unknown bump level/);
  });
});

describe("highestBumpLevel", () => {
  it("picks minor over patch", () => {
    assert.equal(highestBumpLevel(["patch", "minor"]), "minor");
  });

  it("picks major over minor", () => {
    assert.equal(highestBumpLevel(["minor", "patch", "major"]), "major");
  });

  it("defaults to patch for empty list", () => {
    assert.equal(highestBumpLevel([]), "patch");
  });
});

describe("changesetsForPlugin", () => {
  it("filters changesets by plugin name", () => {
    const changesets = [
      { id: "b", releases: [{ name: "@oscaner-skills/osuperpowers", type: "minor" }] },
      {
        id: "c",
        releases: [
          { name: "@oscaner-skills/osuperpowers", type: "patch" },
        ],
      },
    ];
    assert.deepEqual(
      changesetsForPlugin(changesets, "@oscaner-skills/osuperpowers").map(
        (cs) => cs.id,
      ),
      ["b", "c"],
    );
  });

  it("returns empty for missing releases array", () => {
    assert.deepEqual(
      changesetsForPlugin([{ id: "x" }], "@oscaner-skills/osuperpowers"),
      [],
    );
  });
});
