// packages/cdd-engine/src/infra/__tests__/invoke.dispatch-set.test.ts — spec D-3 C5: dispatch-set
// constancy. The engine-controlled set (cli / invoke arg string / cwd / env) for the same
// (harness, op, type) is byte-identical across re-dispatches — the input precondition that makes
// C4's static-zone memo productive (a stable tree is enforced by the commit double-gate). model is
// harness-decided, never set by the engine; the set under test is what the engine actually spawns.
import { describe, expect, it } from "vitest";
import { buildInvokeArgs, composeDispatchSet, promptArgText } from "../invoke.ts";
import { loadRegistry, REG_PATH, resolveInjection, resolveSuffix } from "../registry.ts";

const reg = loadRegistry(REG_PATH);

describe("C5 — dispatch-set composition (invoke string / cwd / env)", () => {
  it("assembly = [registry prefix, prompt, suffix] joined on newlines (C1: prefix precedes the prompt)", () => {
    expect(promptArgText("/p", "hello", "bye")).toBe("/p\nhello\nbye");
    expect(promptArgText("", "hello", "")).toBe("hello"); // no prefix/suffix → prompt verbatim
  });

  it("buildInvokeArgs = invoke spec words + prompt arg last", () => {
    expect(buildInvokeArgs("-p --output-format text", "the prompt")).toEqual([
      "-p",
      "--output-format",
      "text",
      "the prompt",
    ]);
  });

  it("same (harness, op, type) + same inputs → byte-identical dispatch set (byte-equal args/cwd/env)", () => {
    const entry = reg.claude;
    const set1 = composeDispatchSet(entry, { op: "implement" }, "prompt A", "/wsA", {
      PATH: "/usr/bin",
      HOME: "/h",
    });
    const set2 = composeDispatchSet(entry, { op: "implement" }, "prompt A", "/wsA", {
      PATH: "/usr/bin",
      HOME: "/h",
    });
    expect(set2).toEqual(set1);
    expect(set2.args).toEqual(set1.args);
    expect(set2.cwd).toBe(set1.cwd);
    expect(set2.env).toEqual(set1.env);
  });

  it("the real claude implement set starts with the /mattpocock-skills:tdd prefix line and ends with the prompt", () => {
    const set = composeDispatchSet(reg.claude, { op: "implement" }, "line1\nline2", "/ws", {
      PATH: "/usr/bin",
    });
    expect(set.cli).toBe("claude");
    expect(set.args.slice(0, -1)).toEqual([
      "-p",
      "--output-format",
      "text",
      "--dangerously-skip-permissions",
    ]);
    const promptArg = set.args.at(-1);
    expect(promptArg!.split("\n")[0]).toBe("/mattpocock-skills:tdd");
    expect(promptArg!.endsWith("line1\nline2")).toBe(true);
  });

  it("(op, type) granularity resolves distinct prefixes deterministically (registry-driven, zero env sway)", () => {
    const entry = reg.claude;
    const implement = composeDispatchSet(entry, { op: "implement" }, "P", "/ws", {});
    const reviewTask = composeDispatchSet(entry, { op: "review", type: "task" }, "P", "/ws", {});
    expect(implement.args.at(-1)).toContain("/mattpocock-skills:tdd");
    expect(reviewTask.args.at(-1)).toContain("/mattpocock-skills:code-review");
    // The resolved injection strings are the single source — deterministic re-resolution.
    expect(resolveInjection(entry, "review", "task")).toBe(
      resolveInjection(entry, "review", "task"),
    );
    expect(resolveSuffix(entry, "implement")).toBe("");
  });

  it("env passes through untouched (engine never rewrites the dispatch env)", () => {
    const env = { PATH: "/usr/bin", CDD_SHOULD_NOT_EXIST: "x" };
    const set = composeDispatchSet(
      reg["cursor-agent"],
      { op: "fix", type: "task" },
      "P",
      "/ws",
      env,
    );
    expect(set.env).toBe(env); // same reference — passthrough, zero CDD_* injection
  });
});
