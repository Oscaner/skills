// packages/cdd-engine/src/infra/__tests__/infra.context.test.ts
// Mirrors the .mjs suite's assertion set: loadContract returns the same canonical object;
// the timeout defaults come from the canonical JSON (no literals in this module).
import { expect, it } from "vitest";

import { loadContract } from "../context.ts";

it("loadContract reads the canonical contract (timeouts defaults present)", () => {
  const c = loadContract();
  expect(c.timeouts.defaults.task).toBe(10_800_000);
  expect(c.timeouts.defaults.review).toBe(3_600_000);
});

it("canonical env whitelist = 4 keys (same single declaration point)", () => {
  const c = loadContract();
  const keys = Object.values(c.channels.env).flatMap((v) => (v.var ? [v.var] : (v.markers ?? [])));
  expect(keys.sort()).toEqual(["AI_AGENT", "CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "PATH"]);
});
