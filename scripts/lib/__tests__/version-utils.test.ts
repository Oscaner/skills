import { describe, expect, it } from "vitest";
import { versionService } from "../version-utils.ts";

describe("parseSemver", () => {
  it("parses plain semver", () => {
    expect(versionService.parseSemver("0.1.0")).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
    });
  });

  it("rejects non-version strings", () => {
    expect(versionService.parseSemver("not-a-version")).toBe(null);
  });
});

describe("computeNextIndependentVersion", () => {
  it("increments patch", () => {
    expect(versionService.computeNextIndependentVersion("0.1.0", "patch")).toBe("0.1.1");
  });

  it("increments minor and resets patch", () => {
    expect(versionService.computeNextIndependentVersion("0.1.3", "minor")).toBe("0.2.0");
  });

  it("increments major and resets minor+patch", () => {
    expect(versionService.computeNextIndependentVersion("0.9.7", "major")).toBe("1.0.0");
  });

  it("throws on invalid current version", () => {
    expect(() => versionService.computeNextIndependentVersion("bad", "patch")).toThrow(
      /Invalid semver/,
    );
  });

  it("throws on unknown bump level", () => {
    expect(() => versionService.computeNextIndependentVersion("0.1.0", "none")).toThrow(
      /Unknown bump level/,
    );
  });

  it("validates bump level before current version on doubly-invalid input", () => {
    expect(() => versionService.computeNextIndependentVersion("bad", "none")).toThrow(
      /Unknown bump level/,
    );
  });
});

describe("highestBumpLevel", () => {
  it("picks minor over patch", () => {
    expect(versionService.highestBumpLevel(["patch", "minor"])).toBe("minor");
  });

  it("picks major over minor", () => {
    expect(versionService.highestBumpLevel(["minor", "patch", "major"])).toBe("major");
  });

  it("defaults to patch for empty list", () => {
    expect(versionService.highestBumpLevel([])).toBe("patch");
  });
});

describe("changesetsForPlugin", () => {
  it("filters changesets by plugin name", () => {
    const changesets = [
      { id: "b", releases: [{ name: "@oscaner-skills/osuperpowers", type: "minor" }] },
      {
        id: "c",
        releases: [{ name: "@oscaner-skills/osuperpowers", type: "patch" }],
      },
    ];
    expect(
      versionService
        .changesetsForPlugin(changesets, "@oscaner-skills/osuperpowers")
        .map((cs) => cs.id),
    ).toEqual(["b", "c"]);
  });

  it("returns empty for missing releases array", () => {
    expect(
      versionService.changesetsForPlugin([{ id: "x" }], "@oscaner-skills/osuperpowers"),
    ).toEqual([]);
  });
});
