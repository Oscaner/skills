import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseOverridesVersion,
  computeNextVersion,
} from "./version-utils.mjs";

describe("parseOverridesVersion", () => {
  it("parses .0", () => {
    assert.deepEqual(parseOverridesVersion("6.3.0-overrides.0"), {
      base: "6.3.0",
      n: 0,
    });
  });
});

describe("computeNextVersion", () => {
  it("base reset returns .0 not .1", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.11", "6.3.0"),
      "6.3.0-overrides.0",
    );
  });
  it("increments on same base from .0", () => {
    assert.equal(
      computeNextVersion("6.3.0-overrides.0", "6.3.0"),
      "6.3.0-overrides.1",
    );
  });
  it("increments from .11", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.11", "6.2.0"),
      "6.2.0-overrides.12",
    );
  });
});
