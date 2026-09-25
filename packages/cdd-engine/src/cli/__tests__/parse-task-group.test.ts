// packages/cdd-engine/src/cli/__tests__/parse-task-group.test.ts
// The `--tasks` parsing CLI boundary (P4.4 Task 3 ⑤/⑥ breaking surface): parseTaskList — the
// TaskGroup-fromTokens boundary — returns the canonical group value object, and the hyphen form
// (`1-2`) / empty / non-integer tokens all reject with the exit-2 usage face (never a fabricated
// group, never a NaN artifact).

import { describe, expect, it } from "vitest";
import { TaskGroup } from "../../domain/task-group.ts";
import { TaskListParser } from "../shared.ts";

const taskListParser = new TaskListParser();

describe("parseTaskList — the --tasks CLI boundary (TaskGroup)", () => {
  it("returns the canonical TaskGroup (dedupe + ascending sort + comma key)", () => {
    expect(taskListParser.parse("3, 1,3,2")).toBeInstanceOf(TaskGroup);
    expect(taskListParser.parse("3, 1,3,2").key()).toBe("1,2,3");
    expect(taskListParser.parse("1").key()).toBe("1");
    expect(taskListParser.parse("1,2").key()).toBe("1,2");
  });

  it("hyphen form `1-2` (legacy range shape) is an illegal token → CLIError exit 2 face", () => {
    try {
      taskListParser.parse("1-2");
      expect.fail("expected the CLI usage error");
    } catch (e) {
      const err = e as { name?: string; exitCode?: number; message?: string };
      expect(err.name).toBe("CLIError");
      expect(err.exitCode).toBe(2);
      expect(err.message).toMatch(/--tasks must be comma-separated integers: 1-2/);
    }
  });

  it("empty / trailing-comma slices and non-integer tokens reject the same way", () => {
    for (const bad of ["", "abc", "1.5", "1,", "1, ,2"]) {
      try {
        taskListParser.parse(bad);
        expect.fail(`expected rejection for ${JSON.stringify(bad)}`);
      } catch (e) {
        expect((e as { exitCode?: number }).exitCode, bad).toBe(2);
        expect((e as { name?: string }).name, bad).toBe("CLIError");
      }
    }
  });
});
