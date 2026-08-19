import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Cursor enforce hook contract (preToolUse): when a pending attach marker exists
// for the session, the first tool call must be Read(<target SKILL.md path>) or
// Skill(<target name>); everything else is denied with a MANDATORY OVERRIDE
// message. No pending / expired pending → allow. Contract is fail-open.
const ENFORCE = fileURLToPath(
  new URL("../../osuperpowers-router/bin/cursor-enforce.mjs", import.meta.url),
);

const OVERRIDE = "osuperpowers:brainstorming";
const SKILL_SUFFIX = "../osuperpowers/skills/brainstorming/SKILL.md";
const TARGET_SKILL_PATH = "/repo/packages/osuperpowers/skills/brainstorming/SKILL.md";

let pendingRoot;
const savedTmpdir = process.env.TMPDIR;

function setup() {
  pendingRoot = mkdtempSync(join(tmpdir(), "oscaner-enforce-"));
  process.env.TMPDIR = pendingRoot;
}

function teardown() {
  if (savedTmpdir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = savedTmpdir;
  rmSync(pendingRoot, { recursive: true, force: true });
}

function pendingPath(key) {
  return join(
    pendingRoot,
    "oscaner-osuperpowers-router",
    "pending",
    `${key}.json`,
  );
}

function writePending(key, detectedAt = Math.floor(Date.now() / 1000)) {
  const dir = join(pendingRoot, "oscaner-osuperpowers-router", "pending");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${key}.json`),
    JSON.stringify({
      override: OVERRIDE,
      skill_suffix: SKILL_SUFFIX,
      trigger: "attach",
      detected_at: detectedAt,
    }),
  );
}

function enforce(input) {
  return execFileSync("node", [ENFORCE], { input, encoding: "utf8" });
}

function enforceTool(conversationId, toolName, toolInput) {
  return enforce(
    JSON.stringify({ conversation_id: conversationId, tool_name: toolName, tool_input: toolInput }),
  );
}

test("cursor-enforce: no pending → allow", () => {
  setup();
  try {
    const out = enforceTool("conv-none", "Grep", { pattern: "foo" });
    assert.deepEqual(JSON.parse(out), { permission: "allow" });
  } finally {
    teardown();
  }
});

test("cursor-enforce: pending + non-target first tool → deny with MANDATORY OVERRIDE message", () => {
  setup();
  try {
    writePending("conv-e1");
    const out = enforceTool("conv-e1", "Grep", { pattern: "foo" });
    const msg = JSON.parse(out).agent_message;
    assert.equal(JSON.parse(out).permission, "deny");
    assert.match(msg, /MANDATORY OVERRIDE/);
    assert.match(msg, /upstream skill attached/);
    assert.ok(msg.includes(SKILL_SUFFIX), "message carries the target SKILL suffix");
    assert.ok(msg.includes(OVERRIDE), "message carries the target name");
  } finally {
    teardown();
  }
});

test("cursor-enforce: pending + Read target SKILL path → allow and clear pending", () => {
  setup();
  try {
    writePending("conv-e2");
    const out = enforceTool("conv-e2", "Read", { path: TARGET_SKILL_PATH });
    assert.deepEqual(JSON.parse(out), { permission: "allow" });
    assert.ok(!existsSync(pendingPath("conv-e2")), "pending cleared after allow");
  } finally {
    teardown();
  }
});

test("cursor-enforce: pending + Read via file_path (Cursor shape) → allow and clear", () => {
  setup();
  try {
    writePending("conv-e2b");
    const out = enforceTool("conv-e2b", "Read", { file_path: TARGET_SKILL_PATH });
    assert.deepEqual(JSON.parse(out), { permission: "allow" });
    assert.ok(!existsSync(pendingPath("conv-e2b")), "pending cleared (file_path)");
  } finally {
    teardown();
  }
});

test("cursor-enforce: pending + Read of non-target path → deny", () => {
  setup();
  try {
    writePending("conv-e3");
    const out = enforceTool("conv-e3", "Read", {
      path: "/repo/packages/osuperpowers/skills/debugging/SKILL.md",
    });
    assert.equal(JSON.parse(out).permission, "deny");
    assert.ok(existsSync(pendingPath("conv-e3")), "pending retained on deny");
  } finally {
    teardown();
  }
});

test("cursor-enforce: pending + Skill(<target>) → allow and clear", () => {
  setup();
  try {
    writePending("conv-e4");
    const out = enforceTool("conv-e4", "Skill", { skill: OVERRIDE });
    assert.deepEqual(JSON.parse(out), { permission: "allow" });
    assert.ok(!existsSync(pendingPath("conv-e4")), "pending cleared after Skill allow");
  } finally {
    teardown();
  }
});

test("cursor-enforce: pending + Skill(wrong target) → deny", () => {
  setup();
  try {
    writePending("conv-e4b");
    const out = enforceTool("conv-e4b", "Skill", { skill: "osuperpowers:debugging" });
    assert.equal(JSON.parse(out).permission, "deny");
  } finally {
    teardown();
  }
});

test("cursor-enforce: expired pending → allow and remove marker", () => {
  setup();
  try {
    const old = Math.floor(Date.now() / 1000) - 301; // TTL = 300
    writePending("conv-e5", old);
    const out = enforceTool("conv-e5", "Grep", { pattern: "x" });
    assert.deepEqual(JSON.parse(out), { permission: "allow" });
    assert.ok(!existsSync(pendingPath("conv-e5")), "expired pending removed");
  } finally {
    teardown();
  }
});

test("cursor-enforce: slash-only session (no pending) allows follow-up Grep", () => {
  setup();
  try {
    const out = enforceTool("conv-slash", "Grep", { pattern: "foo" });
    assert.deepEqual(JSON.parse(out), { permission: "allow" });
  } finally {
    teardown();
  }
});
