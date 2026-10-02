// packages/kairos/tests/no-gate.test.ts — gate subsystem deletion guard (P5 T1).
// Green after the cdd-gate subsystem (bin/gate + hooks + per-harness gate products) is
// deleted wholesale; the two assertions guard against a half-deletion fake green (dir
// present but hooks gone, or vice versa).

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 3 ups → repo root (not 4, which would land in the repo's parent).
const ROOT = path.resolve(HERE, "..", "..", "..");

test("bin/gate dir + hooks.json are both absent", () => {
  assert.ok(!existsSync(path.join(ROOT, "packages/kairos/bin/gate")));
  assert.ok(!existsSync(path.join(ROOT, "packages/kairos/hooks/hooks.json")));
});
