import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseSemverFromTag,
  sortTagsBySemver,
  TAG_PATTERNS,
} from "./submodule-tags.mjs";

describe("parseSemverFromTag", () => {
  it("parses superpowers v tag", () => {
    assert.equal(parseSemverFromTag("v6.2.0", TAG_PATTERNS.superpowers), "6.2.0");
  });
  it("parses impeccable skill-v tag", () => {
    assert.equal(
      parseSemverFromTag("skill-v4.0.4", TAG_PATTERNS.impeccable),
      "4.0.4",
    );
  });
});

describe("sortTagsBySemver", () => {
  it("orders semver highest last", () => {
    const sorted = sortTagsBySemver(
      ["v6.1.0", "v6.2.0", "v6.0.3"],
      TAG_PATTERNS.superpowers,
    );
    assert.equal(sorted.at(-1), "v6.2.0");
  });
});
