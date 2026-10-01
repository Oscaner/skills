// packages/kairos/tests/no-gate.test.mjs — gate subsystem deletion guard (P5 T1).
// cdd-gate 子系统（bin/gate + hooks + per-harness gate 产物）整体删除后本测试绿；
// 两点断言防只删一半假绿（目录在而 hooks 删，或反之）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", ".."); // 3 层 → repo root（勿 4 层，会越到 repo 父目录）

test("bin/gate 目录 + hooks.json 均不存在", () => {
  assert.ok(!existsSync(path.join(ROOT, "packages/kairos/bin/gate")));
  assert.ok(!existsSync(path.join(ROOT, "packages/kairos/hooks/hooks.json")));
});
