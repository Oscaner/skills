// tests/infra.context.test.ts — TS infra layer: context-contract canonical reader (port of context.mjs).
// Mirrors the .mjs suite's assertion set: loadContract returns the same canonical object;
// the timeout defaults come from the canonical JSON (no literals in this module).
import { it, expect } from "vitest";

import { loadContract } from "../src/infra/context.ts";

it("loadContract reads the canonical contract (timeouts defaults present)", () => {
  const c = loadContract();
  expect(c.timeouts.defaults.task).toBe(5_400_000);
  expect(c.timeouts.defaults.review).toBe(3_600_000);
});

it("canonical env whitelist = 7 keys (same single declaration point)", () => {
  const c = loadContract();
  const keys = Object.values(c.channels.env).flatMap((v) => (v.var ? [v.var] : (v.markers ?? [])));
  expect(keys.sort()).toEqual(["AI_AGENT", "CDD_CLI_TIMEOUT", "CDD_REVIEW_TIMEOUT", "CDD_TASK_TIMEOUT",
                               "CLAUDE_CODE_SESSION_ID", "CURSOR_TRACE_ID", "PATH"]);
});
