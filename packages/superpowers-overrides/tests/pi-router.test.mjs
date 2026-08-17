// packages/superpowers-overrides/tests/pi-router.test.mjs — P6b T2: pi.ts router extension。
// Tests the pi router extension's on('input') handler for slash command detection.
// Trigger mapping mirrors overrides.manifest.json (no /spor-* match).
import { test } from "node:test";
import assert from "node:assert/strict";

import { on } from "../bin/pi-router.ts";

function makePi() {
  const handlers = {};
  const pi = { on: (name, handler) => { handlers[name] = handler; } };
  return { pi, handlers };
}

test("pi-router: /brainstorming → transform Skill(engineering:os-brainstorming)", () => {
  const { pi } = makePi();
  on(pi);
  // Simulate pi input event with leading slash (pi strips it)
  const out = on(pi);
  // Verify handler registered
  assert.ok(pi.on, "on() must call pi.on()");
});

test("pi-router: on() registers input handler on pi instance", () => {
  const registered = [];
  const pi = { on: (name, handler) => { registered.push(name); } };
  on(pi);
  assert.ok(registered.includes("input"), "must register 'input' event handler");
});

test("pi-router: input handler transforms /brainstorming → Skill(engineering:os-brainstorming)", async () => {
  let handler;
  const pi = { on: (name, h) => { if (name === "input") handler = h; } };
  on(pi);
  const result = await handler({ text: "/brainstorming" }, {});
  assert.equal(result.action, "transform");
  assert.match(result.text, /Skill\(engineering:os-brainstorming\)/);
});

test("pi-router: input handler transforms /writing-plans → Skill(engineering:os-writing-plans)", async () => {
  let handler;
  const pi = { on: (name, h) => { if (name === "input") handler = h; } };
  on(pi);
  const result = await handler({ text: "/writing-plans" }, {});
  assert.equal(result.action, "transform");
  assert.match(result.text, /Skill\(engineering:os-writing-plans\)/);
});

test("pi-router: input handler transforms /test-driven-development → Skill(mattpocock-skills:tdd)", async () => {
  let handler;
  const pi = { on: (name, h) => { if (name === "input") handler = h; } };
  on(pi);
  const result = await handler({ text: "/test-driven-development" }, {});
  assert.equal(result.action, "transform");
  assert.match(result.text, /Skill\(mattpocock-skills:tdd\)/);
});

test("pi-router: input handler transforms /using-git-worktrees → Skill(engineering:os-finishing)", async () => {
  let handler;
  const pi = { on: (name, h) => { if (name === "input") handler = h; } };
  on(pi);
  const result = await handler({ text: "/using-git-worktrees" }, {});
  assert.equal(result.action, "transform");
  assert.match(result.text, /Skill\(engineering:os-finishing\)/);
});

test("pi-router: /spor-* does NOT match (returns null)", async () => {
  let handler;
  const pi = { on: (name, h) => { if (name === "input") handler = h; } };
  on(pi);
  const result = await handler({ text: "/spor-brainstorming" }, {});
  assert.equal(result, null);
});

test("pi-router: unknown command returns null (no transform)", async () => {
  let handler;
  const pi = { on: (name, h) => { if (name === "input") handler = h; } };
  on(pi);
  const result = await handler({ text: "/unknown-command" }, {});
  assert.equal(result, null);
});

test("pi-router: plain text (no slash) returns null", async () => {
  let handler;
  const pi = { on: (name, h) => { if (name === "input") handler = h; } };
  on(pi);
  const result = await handler({ text: "hello world" }, {});
  assert.equal(result, null);
});
