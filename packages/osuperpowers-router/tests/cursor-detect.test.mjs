import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Cursor detect hook contract (UserPromptSubmit): scan attachment paths for an
// upstream superpowers SKILL.md attach; if found, write a pending marker keyed by
// session (conversation_id || session_id || prompt-hash) so the enforce hook can
// gate the next first tool call. Always outputs {"continue":true}.
const DETECT = fileURLToPath(
  new URL("../../osuperpowers-router/bin/cursor-detect.mjs", import.meta.url),
);

let pendingRoot; // TMPDIR override so the hook writes into an isolated temp tree
const savedTmpdir = process.env.TMPDIR;

function setup() {
  pendingRoot = mkdtempSync(join(tmpdir(), "oscaner-detect-"));
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

function detect(input) {
  return execFileSync("node", [DETECT], { input, encoding: "utf8" });
}

// Upstream attach path shape that must match the vendored superpowers family.
const upstreamAttach = "/fake/vendors/superpowers/skills/brainstorming/SKILL.md";

test("cursor-detect: upstream SKILL.md attach writes pending with target + suffix", () => {
  setup();
  try {
    const out = detect(
      JSON.stringify({
        conversation_id: "conv-a1",
        prompt: "please review",
        attachments: [{ type: "file", file_path: upstreamAttach }],
      }),
    );
    assert.deepEqual(JSON.parse(out), { continue: true });
    const pending = JSON.parse(
      readFileSync(pendingPath("conv-a1"), "utf8"),
    );
    assert.equal(pending.override, "osuperpowers:brainstorming");
    assert.equal(
      pending.skill_suffix,
      "../osuperpowers/skills/brainstorming/SKILL.md",
    );
    assert.equal(pending.trigger, "attach");
    assert.ok(pending.detected_at > 0, "detected_at epoch present");
  } finally {
    teardown();
  }
});

test("cursor-detect: attachment `path` field is accepted (Cursor file shape)", () => {
  setup();
  try {
    detect(
      JSON.stringify({
        conversation_id: "conv-a2",
        prompt: "x",
        attachments: [{ type: "file", path: upstreamAttach }],
      }),
    );
    assert.ok(existsSync(pendingPath("conv-a2")), "pending written from `path`");
  } finally {
    teardown();
  }
});

test("cursor-detect: bare /brainstorming slash writes pending with trigger=slash", () => {
  setup();
  try {
    const out = detect(
      JSON.stringify({
        conversation_id: "conv-a3",
        prompt: "/brainstorming",
        attachments: [],
      }),
    );
    assert.deepEqual(JSON.parse(out), { continue: true });
    const pending = JSON.parse(readFileSync(pendingPath("conv-a3"), "utf8"));
    assert.equal(pending.override, "osuperpowers:brainstorming");
    assert.equal(
      pending.skill_suffix,
      "../osuperpowers/skills/brainstorming/SKILL.md",
    );
    assert.equal(pending.trigger, "slash");
    assert.ok(pending.detected_at > 0, "detected_at epoch present");
  } finally {
    teardown();
  }
});

// Every upstream slug is intercepted by its bare slash — mirrors Claude
// UserPromptExpansion (single SOT = overrides.manifest.json upstream_slug).
const SLASH_TARGETS = [
  ["brainstorming", "osuperpowers:brainstorming", "../osuperpowers/skills/brainstorming/SKILL.md"],
  ["writing-plans", "osuperpowers:writing-plans", "../osuperpowers/skills/writing-plans/SKILL.md"],
  ["subagent-driven-development", "osuperpowers:cli-driven-development", "../osuperpowers/skills/cli-driven-development/SKILL.md"],
  ["finishing-a-development-branch", "osuperpowers:finishing", "../osuperpowers/skills/finishing/SKILL.md"],
  ["test-driven-development", "mattpocock-skills:tdd", "skills/osuperpowers/tdd/SKILL.md"],
  ["using-git-worktrees", "osuperpowers:finishing", "../osuperpowers/skills/finishing/SKILL.md"],
];

for (const [slug, override, suffix] of SLASH_TARGETS) {
  test(`cursor-detect: bare /${slug} slash writes pending with trigger=slash`, () => {
    setup();
    try {
      const key = `slash-${slug}`;
      const out = detect(
        JSON.stringify({
          conversation_id: key,
          prompt: `/${slug}`,
          attachments: [],
        }),
      );
      assert.deepEqual(JSON.parse(out), { continue: true });
      const pending = JSON.parse(readFileSync(pendingPath(key), "utf8"));
      assert.equal(pending.override, override);
      assert.equal(pending.skill_suffix, suffix);
      assert.equal(pending.trigger, "slash");
      assert.ok(pending.detected_at > 0, "detected_at epoch present");
    } finally {
      teardown();
    }
  });
}

test("cursor-detect: inline /brainstorming slash (within prose) writes pending", () => {
  setup();
  try {
    const out = detect(
      JSON.stringify({
        conversation_id: "conv-inline",
        prompt: "please run /brainstorming for this design",
        attachments: [],
      }),
    );
    assert.deepEqual(JSON.parse(out), { continue: true });
    const pending = JSON.parse(readFileSync(pendingPath("conv-inline"), "utf8"));
    assert.equal(pending.override, "osuperpowers:brainstorming");
    assert.equal(pending.trigger, "slash");
  } finally {
    teardown();
  }
});

test("cursor-detect: non-upstream slash writes no pending", () => {
  setup();
  try {
    detect(
      JSON.stringify({
        conversation_id: "conv-neg",
        prompt: "/unknown-skill foo",
        attachments: [],
      }),
    );
    assert.ok(
      !existsSync(pendingPath("conv-neg")),
      "non-upstream slash must not write pending",
    );
  } finally {
    teardown();
  }
});

test("cursor-detect: session_id fallback keys the pending marker", () => {
  setup();
  try {
    detect(
      JSON.stringify({
        session_id: "sess-a4",
        prompt: "/brainstorming",
        attachments: [{ file_path: upstreamAttach }],
      }),
    );
    assert.ok(existsSync(pendingPath("sess-a4")), "pending keyed by session_id");
  } finally {
    teardown();
  }
});

test("cursor-detect: prompt-hash fallback key is a 16-hex sha256", () => {
  setup();
  try {
    const input = JSON.stringify({
      prompt: "attach me",
      attachments: [{ file_path: upstreamAttach }],
    });
    const out = detect(input);
    assert.deepEqual(JSON.parse(out), { continue: true });
    // no conversation_id/session_id → key = sha256(prompt).hex[:16]
    const expected = createHash("sha256").update("attach me").digest("hex").slice(0, 16);
    assert.ok(existsSync(pendingPath(expected)), `pending keyed by prompt hash (${expected})`);
  } finally {
    teardown();
  }
});

test("cursor-detect: unrelated attachment path writes no pending", () => {
  setup();
  try {
    const out = detect(
      JSON.stringify({
        conversation_id: "conv-a6",
        prompt: "x",
        attachments: [{ file_path: "/notes/meeting.md" }],
      }),
    );
    assert.deepEqual(JSON.parse(out), { continue: true });
    assert.ok(!existsSync(pendingPath("conv-a6")));
  } finally {
    teardown();
  }
});
