// packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts
// P40 T5 — the FACE side of the `dispatch-input` row after the judgment left it. The
// row itself (every empty cell, every read path, the closed reason set) is the contract
// plane's judgment and is pinned in `contract/__tests__/preflight-rows.test.ts`; this
// file keeps the two things only the dispatch face can witness:
//
//   · a frame whose declaration leaves `INPUT_SPEC` non-exigible still renders the bytes
//     the round reads (the cell is ABSENT from the row, not emptied);
//   · the face holds NO judgment: a dispatch the seam refused never reaches `step()`, and
//     one the seam passed reaches the child even with a cell the judgment would have
//     refused — the retired gate leaves no second ask behind.
//
// Zero module-level bare functions — every helper is an arrow const / a class.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TestDispatchValues } from "../../__tests__/support/dispatch-values.ts";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../../session/ledger.ts";
import { ArtifactRegistry } from "../../session/round-artifacts.ts";
import type { OpenFrame } from "../../session/run.ts";
import type { CliIo, DispatchScene } from "../lifecycle.ts";
import { CliLifecycle } from "../lifecycle.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../termination.ts";

class SilentIo implements CliIo {
  stdoutText = "";
  stderrText = "";
  stdout(text: string): void {
    this.stdoutText += text;
  }
  stderr(text: string): void {
    this.stderrText += text;
  }
}

/** The child stand-in whose prompt is read — it writes nothing and exits 0. */
class PromptRunner implements ChildRunner {
  calls: ChildRun[] = [];
  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** A hermetic repo: one seed commit, the plan document and `.kairos` kept out of the tree. */
const repoFixture = (): { repoRoot: string; cleanup: () => void } => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "dispatch-input-repo-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "dispatch-input@test"],
    ["config", "user.name", "dispatch-input-test"],
  ]) {
    spawnSync("git", args, { cwd: repoRoot });
  }
  writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n", "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  const planPath = path.join(repoRoot, "docs", "kairos", "plans", "p9.md");
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, "# plan\n\n### Task 1: task 1\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  return { repoRoot, cleanup: () => rmSync(repoRoot, { recursive: true, force: true }) };
};

/** The review frame of the fixture's wave. */
const reviewFrameOf = (): OpenFrame => ({
  type: "wave",
  phase: "review",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1", round: 1 },
  key: "1",
});

/** The fixture's scene over its own workspace — the two cells the cases vary. */
const sceneOf = (workspace: Workspace, over: Partial<DispatchScene> = {}): DispatchScene => ({
  workspace,
  ledger: new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis)),
  planPath: null,
  plan: planSourceOf(workspace.root.basis).readFor(null),
  briefPath: path.join(workspace.path, "tasks-1-brief.md"),
  baseBranch: "develop",
  specLink: null,
  overallLink: null,
  program: null,
  docType: null,
  ...over,
});

describe("the dispatch face after the judgment left it (P40 T5)", () => {
  it("(i) a declared `slug:` with no `doc-type:` leaves `INPUT_SPEC` non-exigible — the bytes stand", async () => {
    const f = repoFixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(f.repoRoot, ".kairos/cdd"), "p9").ensure();
      const brief = path.join(workspace.path, "tasks-1-brief.md");
      writeFileSync(brief, "# brief\n", "utf8");
      // P37 T4's ④ arm: the identity document is on disk with `slug:` but no `doc-type:`,
      // so the index hands `docType: null` — the shape the row reads as "not declared".
      const scene = sceneOf(workspace, { briefPath: brief, docType: null });
      const io = new SilentIo();
      const runner = new PromptRunner();
      const lifecycle = new CliLifecycle({
        scene,
        artifacts: new ArtifactRegistry(),
        io,
        sync: runner,
        host: "claude",
        values: TestDispatchValues.of(scene, reviewFrameOf()),
      });
      await lifecycle.step()(reviewFrameOf());
      // The seam passed it, so the face dispatches: the child exists and the block
      // channel never named the row.
      expect(runner.calls).toHaveLength(1);
      expect(io.stderrText).not.toContain("dispatch-input");
      // The cell is ABSENT from the row, not emptied: the round context carries no line
      // for it (the shell prose still names the token — that is the fixed prefix's text).
      const prompt = runner.calls[0]?.args.join(" ") ?? "";
      expect(prompt).toContain("- `INPUT_WAVE_BRIEF`: ");
      expect(prompt).not.toContain("- `INPUT_SPEC`: ");
    } finally {
      f.cleanup();
    }
  });

  it("(m) judges nothing itself — a broken cell reaches the child, and the seam owns the refusal", async () => {
    const f = repoFixture();
    try {
      const workspace = new Workspace(new WorkspaceRoot(f.repoRoot, ".kairos/cdd"), "p9").ensure();
      // The wave brief is not on disk and the base artifact names no branch: the two
      // cells the seam's `dispatch-input` row refuses. The FACE is never asked that
      // question again (P40 T5), so the dispatch body runs to the child — the refusal
      // belongs to the seam's verdict, one layer up, and the retired gate left no second
      // ask (a second ask would be a second source of truth).
      const scene = sceneOf(workspace, { briefPath: null, baseBranch: "" });
      const io = new SilentIo();
      const runner = new PromptRunner();
      const lifecycle = new CliLifecycle({
        scene,
        artifacts: new ArtifactRegistry(),
        io,
        sync: runner,
        host: "claude",
        values: TestDispatchValues.of(scene, reviewFrameOf()),
      });
      await lifecycle.step()(reviewFrameOf());
      expect(runner.calls).toHaveLength(1);
      expect(io.stderrText).not.toContain("dispatch-input");
      // The prompt is the injected record's render, cell for cell: the brief is a NAME the
      // engine derives (the file is written after the seam judges, so its absence on disk
      // is not a fact the record can carry), while the scope anchor the seam refuses is
      // simply the empty slot the assembler drops.
      const prompt = runner.calls[0]?.args.join(" ") ?? "";
      expect(prompt).toContain("- `INPUT_WAVE_BRIEF`: .kairos/cdd/p9/tasks-1-brief.md");
      expect(prompt).not.toContain("- `BASE_BRANCH`: ");
    } finally {
      f.cleanup();
    }
  });
});
