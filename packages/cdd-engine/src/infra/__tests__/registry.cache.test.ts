// packages/cdd-engine/src/infra/__tests__/registry.cache.test.ts — spec D-3 C7: per-harness cache
// profile capability-as-data. harness-registry.json entries carry a `cache` profile (mechanism /
// minTokens / readMultiplier / writeMultiplier / ttlMinutes / observable); the profile validates
// against templates/schema/cache-profile-schema.json (ajv, same pattern as rules/schema.ts). Read
// the REAL registry file — the profile is data, not prose, and adding a harness = one registry row.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REG_PATH, Registry, validateCacheProfile } from "../registry.ts";

const registry = new Registry();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("registry cache profile (spec D-3 C7 — capability as data)", () => {
  const reg = registry.load(REG_PATH);

  it("claude profile = explicit / 512 / 0.1 / 1.25 / 5 / observable (doctrine baseline)", () => {
    expect(registry.cacheProfileFor(reg.claude)).toEqual({
      mechanism: "explicit",
      minTokens: 512,
      readMultiplier: 0.1,
      writeMultiplier: 1.25,
      ttlMinutes: 5,
      observable: true,
    });
  });

  it("cursor-agent profile = auto-prefix fallback, values pending measurement", () => {
    expect(registry.cacheProfileFor(reg["cursor-agent"])).toMatchObject({
      mechanism: "auto-prefix",
      minTokens: "pending",
      observable: false,
    });
  });

  it("both real profiles validate against the JSON schema (cache-profile-schema.json)", () => {
    for (const harness of Object.keys(reg)) {
      const result = validateCacheProfile(registry.cacheProfileFor(reg[harness]));
      expect(result.valid, harness).toBe(true);
    }
  });

  it("the profile schema file ships next to the other handoff schemas", () => {
    const schemaPath = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "templates",
      "schema",
      "cache-profile-schema.json",
    );
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      title?: string;
      additionalProperties?: boolean;
    };
    expect(schema.title).toBeTruthy();
    expect(schema.additionalProperties).toBe(false); // no undeclared profile keys
  });

  it("invalid profiles are rejected (unknown mechanism / missing required / zero minTokens)", () => {
    expect(validateCacheProfile({ mechanism: "nope" }).valid).toBe(false);
    expect(validateCacheProfile({}).valid).toBe(false);
    expect(validateCacheProfile({ mechanism: "explicit", minTokens: 0 }).valid).toBe(false);
    expect(validateCacheProfile(null).valid).toBe(false);
  });
});
