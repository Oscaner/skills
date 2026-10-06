// packages/cdd-engine/src/documents/doctypes/body/__tests__/task.test.ts — the plan task data model
// (P2 T1; plan §T1 · Criterion ②). Covers the T1 task-model deliverable surface: the full field
// family (objective / files / interface{consumes,produces} / steps{action,checkable} / acceptance
// + the NON-OPTIONAL dependsOn/atomicWith edge fields) carries constructor-injected identity on a
// read-only face; the edge fields default to `[]` on absence (the no-edge default — the P3.1 T3
// absent-default pin retirement) and the missing-edge record defaults false; and the required
// step.checkable is a type-level constraint — enforced by the repo tsc --noEmit gate (the
// NotAssignable assertion below), never by a runtime guard (the schema- validation machine face the
// T3 PlanBody brief render consumes).
import { describe, expect, it } from "vitest";
import { Task, type TaskStep } from "../task.ts";

// ---- type-level contract surface (tsc --noEmit gate; zero escape directives) ----

/** The type-level assertion carrier — `Expect<T extends true>` compiles only while its argument is
 *  exactly `true`; a flipped contract surface (a `false` argument) fails the whole file. */
type Expect<T extends true> = T;

/** Non-assignability probe — true while `From` is NOT assignable to `To` (extends-conditional:
 *  excess-property checks do not apply, so only a genuinely missing required member flips the
 *  result — the step contract's checkable requirement is exactly that). */
type NotAssignable<From, To> = From extends To ? false : true;

// A step omitting checkable is rejected by the step contract — the type-level construction
// constraint (missing checkable → the `{ action }` literal is not a TaskStep). Drift signal: making
// checkable optional flips NotAssignable to false and fails compilation.
type _stepRequiresCheckable = Expect<NotAssignable<{ action: string }, TaskStep>>;

describe("Task — the plan task data model", () => {
  it("the full field surface carries constructor-injected identity", () => {
    const task = new Task({
      objective: "Deliver the DocBody framework core",
      files: ["src/documents/doctypes/body/doc-body.ts"],
      interface: {
        consumes: ["src/documents/doctypes/body/task.ts"],
        produces: ["src/documents/doctypes/body/doc-body.ts"],
      },
      steps: [
        {
          action: "Declare the abstract DocBody contract",
          checkable: "doc-body.ts exports an abstract class DocBody",
        },
        {
          action: "Pin the two projection members",
          checkable: "StubDocBody implementing both projections compiles",
        },
      ],
      acceptance: ["doc-body.ts carries the two projection contract surfaces"],
      dependsOn: [2],
      atomicWith: [3],
    });
    expect(task.objective).toBe("Deliver the DocBody framework core");
    expect(task.files).toEqual(["src/documents/doctypes/body/doc-body.ts"]);
    expect(task.interface).toEqual({
      consumes: ["src/documents/doctypes/body/task.ts"],
      produces: ["src/documents/doctypes/body/doc-body.ts"],
    });
    expect(task.steps).toEqual([
      {
        action: "Declare the abstract DocBody contract",
        checkable: "doc-body.ts exports an abstract class DocBody",
      },
      {
        action: "Pin the two projection members",
        checkable: "StubDocBody implementing both projections compiles",
      },
    ]);
    expect(task.acceptance).toEqual(["doc-body.ts carries the two projection contract surfaces"]);
    expect(task.dependsOn).toEqual([2]);
    expect(task.atomicWith).toEqual([3]);
    expect(task.missingEdge).toBe(false);
  });

  it("the edge fields are non-optional — absent declarations default to `[]` (the P3.1 T3 absent-default pin retirement: `toBe([])` replaces the retired `toBeUndefined()`)", () => {
    const task = new Task({
      objective: "Minimal task without the edge-model bits",
      files: [],
      interface: { consumes: [], produces: [] },
      steps: [],
      acceptance: [],
    });
    expect(task.dependsOn).toEqual([]);
    expect(task.atomicWith).toEqual([]);
    expect(task.missingEdge).toBe(false);
  });

  it("a checkable-carrying step constructs (the accept side of the step contract)", () => {
    const task = new Task({
      objective: "x",
      files: [],
      interface: { consumes: [], produces: [] },
      steps: [{ action: "Implement", checkable: "checks pass" }],
      acceptance: [],
    });
    expect(task.steps).toEqual([{ action: "Implement", checkable: "checks pass" }]);
  });
});
