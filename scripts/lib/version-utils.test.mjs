import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseRouterVersion,
  computeNextVersion,
  parseSemver,
  computeNextIndependentVersion,
  highestBumpLevel,
  changesetsForPlugin,
} from "./version-utils.mjs";

describe("parseRouterVersion", () => {
  it("parses three-segment suffix", () => {
    assert.deepEqual(parseRouterVersion("6.2.0-router.0.15.0"), {
      base: "6.2.0",
      major: 0,
      minor: 15,
      patch: 0,
    });
  });

  it("rejects legacy single-counter format", () => {
    assert.equal(parseRouterVersion("6.2.0-router.15"), null);
  });
});

describe("computeNextVersion", () => {
  it("increments patch on same base", () => {
    assert.equal(
      computeNextVersion("6.2.0-router.0.15.0", "6.2.0"),
      "6.2.0-router.0.15.1",
    );
  });

  it("resets on superpowers minor bump", () => {
    assert.equal(
      computeNextVersion("6.2.0-router.0.15.3", "6.3.0"),
      "6.3.0-router.0.0.0",
    );
  });

  it("resets on superpowers patch bump", () => {
    assert.equal(
      computeNextVersion("6.2.0-router.0.15.0", "6.2.1"),
      "6.2.1-router.0.0.0",
    );
  });

  it("returns 0.0.0 for unknown current on new base", () => {
    assert.equal(
      computeNextVersion("not-a-version", "6.2.0"),
      "6.2.0-router.0.0.0",
    );
  });
});

describe("parseSemver", () => {
  it("parses plain semver", () => {
    assert.deepEqual(parseSemver("0.1.0"), {
      major: 0,
      minor: 1,
      patch: 0,
    });
  });

  it("rejects router suffixed versions", () => {
    assert.equal(parseSemver("6.2.0-router.0.15.0"), null);
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
      {
        id: "a",
        releases: [{ name: "@oscaner-skills/osuperpowers-router", type: "patch" }],
      },
      { id: "b", releases: [{ name: "@oscaner-skills/osuperpowers", type: "minor" }] },
      {
        id: "c",
        releases: [
          { name: "@oscaner-skills/osuperpowers", type: "patch" },
          { name: "@oscaner-skills/osuperpowers-router", type: "patch" },
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
