import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseOverridesVersion,
  computeNextVersion,
} from "./version-utils.mjs";

describe("parseOverridesVersion", () => {
  it("parses three-segment suffix", () => {
    assert.deepEqual(parseOverridesVersion("6.2.0-overrides.0.15.0"), {
      base: "6.2.0",
      major: 0,
      minor: 15,
      patch: 0,
    });
  });

  it("rejects legacy single-counter format", () => {
    assert.equal(parseOverridesVersion("6.2.0-overrides.15"), null);
  });
});

describe("computeNextVersion", () => {
  it("increments patch on same base", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.0.15.0", "6.2.0"),
      "6.2.0-overrides.0.15.1",
    );
  });

  it("resets on superpowers minor bump", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.0.15.3", "6.3.0"),
      "6.3.0-overrides.0.0.0",
    );
  });

  it("resets on superpowers patch bump", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.0.15.0", "6.2.1"),
      "6.2.1-overrides.0.0.0",
    );
  });

  it("returns 0.0.0 for unknown current on new base", () => {
    assert.equal(
      computeNextVersion("not-a-version", "6.2.0"),
      "6.2.0-overrides.0.0.0",
    );
  });
});
