import { describe, it, expect } from "vitest";
import {
  parseSemverFromTag,
  sortTagsBySemver,
  TAG_PATTERNS,
} from "./submodule-tags.mjs";

describe("parseSemverFromTag", () => {
  it("parses superpowers v tag", () => {
    expect(parseSemverFromTag("v6.2.0", TAG_PATTERNS.superpowers)).toBe("6.2.0");
  });
  it("parses impeccable skill-v tag", () => {
    expect(
      parseSemverFromTag("skill-v4.0.4", TAG_PATTERNS.impeccable),
    ).toBe("4.0.4");
  });
});

describe("sortTagsBySemver", () => {
  it("orders semver highest last", () => {
    const sorted = sortTagsBySemver(
      ["v6.1.0", "v6.2.0", "v6.0.3"],
      TAG_PATTERNS.superpowers,
    );
    expect(sorted.at(-1)).toBe("v6.2.0");
  });
});

describe("semverFromNearestTag", () => {
  it("derives semver from tag name", () => {
    expect(
      parseSemverFromTag("v1.1.0", TAG_PATTERNS["mattpocock-skills"]),
    ).toBe("1.1.0");
  });
});
