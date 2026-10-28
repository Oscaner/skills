// packages/cdd-engine/src-next/face/__tests__/preview.test.ts
// P11 T5 — the `--dry-run` preview pins. Two faces:
//
//   · the renderer (face/preview.ts) — the §3.3 five-row block, byte for byte, over
//     the four target faces; the `child:` row's detected-host and no-host forms.
//     The renderer touches no disk for these (the names are pure path arithmetic),
//     so the scene is constructed inline and the env is injected.
//   · the CLI face — the preview's zero-write semantics on a real fixture repo
//     (`.kairos/` absent, `git status --porcelain` byte-identical, no round
//     consumed), the pre-flight refusal face's identity with the real run's, the
//     flag's narrowed scope (exit 2 on the pure commands), and the bootstrap's
//     preview (the would-run plan at zero spawn).

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { ProcessFacts } from "../../infra/proc.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../../session/ledger.ts";
import type { DispatchOutcome, OpenFrame } from "../../session/run.ts";
import type { CliIo, CliOptions, DispatchScene } from "../cli.ts";
import { Cli } from "../cli.ts";
import type { StepRunner } from "../init.ts";
import { Preview } from "../preview.ts";

// ---------------------------------------------------------------------------
// the renderer's inline scene (no disk)
// ---------------------------------------------------------------------------

const ROOT = "/repo";
const WORKSPACE = new Workspace(new WorkspaceRoot(ROOT, ".kairos/cdd"), "p3");

/** The scene the preview reads — the same DispatchScene shape the lifecycle
 *  dispatch reads (one scene shape, never a second). */
const scene = (over: Partial<DispatchScene> = {}): DispatchScene => ({
  workspace: WORKSPACE,
  ledger: new Ledger(WORKSPACE, new ConfigLoader()),
  planPath: path.join(ROOT, "docs", "kairos", "plans", "p3.md"),
  briefPath: null,
  ...over,
});

/** A frame from the wave-review shape; `over` supplies the face. */
const frame = (over: Partial<OpenFrame> = {}): OpenFrame => ({
  type: "wave",
  phase: "review",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1", round: 1 },
  key: "1",
  ...over,
});

/** A preview over the inline scene with a pinned env — `{}` detects no host, so
 *  the test process's own markers never leak into the `child:` row. */
const preview = (env: Record<string, string | undefined> = {}): Preview =>
  new Preview({ scene: scene(), env });

describe("Preview — the §3.3 five-row block", () => {
  it("renders the wave review block byte for byte", () => {
    expect(preview().render("review", frame())).toEqual([
      "cdd review: preview (no repo changes)",
      "  step:        review round 1 — wave 1",
      "  reads:       .kairos/cdd/p3/tasks-1-brief.md (would re-render from the current plan)",
      "  would write: .kairos/cdd/p3/tasks-1-review-1.json · .kairos/cdd/p3/tasks-1-review-1-report.md",
      '  would record: progress.waves["1"].rounds.review += [1] · reviewedRevision(brief)',
      "  child:       (no host detected — real run would BLOCK)",
    ]);
  });

  it("names the work face's full prescribed write set — carrier, report and test evidence", () => {
    const lines = preview().render(
      "implement",
      frame({
        phase: "implement",
        round: 1,
        target: { kind: "wave", tasks: [2, 5] },
        params: { tasks: "2,5" },
        key: "2,5",
      }),
    );
    expect(lines[1]).toBe("  step:        implement round 1 — wave 2,5");
    expect(lines[3]).toBe(
      "  would write: .kairos/cdd/p3/tasks-2,5-implement.json · .kairos/cdd/p3/tasks-2,5-implement-report.md · .kairos/cdd/p3/tasks-2,5-test-evidence.json",
    );
    // the implement round is never a review: no reviewed-revision write-back leg
    expect(lines[4]).toBe('  would record: progress.waves["2,5"].rounds.implement += [1]');
  });

  it("renders the spec line — the judged document as the read input, no brief re-render", () => {
    const lines = preview().render(
      "review",
      frame({
        type: "spec",
        round: 1,
        target: { kind: "spec", doc: path.join(ROOT, "docs", "kairos", "specs", "p3-design.md") },
        params: { round: 1 },
        key: "spec",
      }),
    );
    expect(lines[1]).toBe("  step:        review round 1 — spec");
    expect(lines[2]).toBe("  reads:       docs/kairos/specs/p3-design.md");
    expect(lines[3]).toBe(
      "  would write: .kairos/cdd/p3/spec-review-1.json · .kairos/cdd/p3/spec-review-1-report.md",
    );
    expect(lines[4]).toBe(
      '  would record: progress.waves["spec"].rounds.review += [1] · reviewedRevision(doc)',
    );
  });

  it("renders the branch line — its review binds no reviewed revision (the live-tree audit)", () => {
    const lines = preview().render(
      "review",
      frame({
        type: "branch",
        phase: "branch-review",
        round: 2,
        target: { kind: "branch" },
        params: { round: 2 },
        key: "branch",
      }),
    );
    expect(lines[1]).toBe("  step:        branch-review round 2 — branch");
    expect(lines[2]).toBe("  reads:       docs/kairos/plans/p3.md");
    expect(lines[3]).toBe(
      "  would write: .kairos/cdd/p3/branch-review-2.json · .kairos/cdd/p3/branch-review-2-report.md",
    );
    expect(lines[4]).toBe('  would record: progress.waves["branch"].rounds.branch-review += [2]');
  });

  it("the child row names the detected host id + the row's invoke string, never the detect marker", () => {
    const lines = new Preview({
      scene: scene(),
      env: { CLAUDE_CODE_SESSION_ID: "s" },
    }).render("review", frame());
    // the leading token is the HOST ID ("claude"); the harness row's binary name
    // (the `cli` column) is a separate fact and never rides this row
    expect(lines[5]).toBe(
      "  child:       claude -p --output-format text --dangerously-skip-permissions --exclude-dynamic-system-prompt-sections",
    );
  });
});

// ---------------------------------------------------------------------------
// the CLI face (a hermetic fixture repo)
// ---------------------------------------------------------------------------

/** The captured io — the CLI's stdout/stderr seam (never the process). */
class CaptureIo implements CliIo {
  stdoutText = "";
  stderrText = "";
  stdout(text: string): void {
    this.stdoutText += text;
  }
  stderr(text: string): void {
    this.stderrText += text;
  }
}

interface CliFixture {
  command: Cli;
  io: CaptureIo;
  repoRoot: string;
  cleanup: () => void;
}

/** The process cwd before any fixture chdir — restored after every test (the
 *  engine resolves the repo root from the working directory). */
const ORIGINAL_CWD = process.cwd();
afterEach(() => {
  process.chdir(ORIGINAL_CWD);
});

/** The stand-in init runner — records every argv, returns 0. The preview path must
 *  leave `calls` empty: a preview that spawns is not a preview. */
class RecordingRunner implements StepRunner {
  readonly calls: (readonly string[])[] = [];
  async run(argv: readonly string[]): Promise<number> {
    this.calls.push(argv);
    return 0;
  }
}

/** A hermetic CLI fixture — a fresh temp repo, the io captured, the cwd isolated
 *  into the temp root (taken through `realpathSync`: the engine's git-top-level
 *  resolution returns the REAL path, so the fixture must speak the same basis). */
const fixture = (opts: CliOptions = {}): CliFixture => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "preview-")));
  process.chdir(repoRoot);
  const io = new CaptureIo();
  const command = Cli.create({ io, ...opts });
  return {
    command,
    io,
    repoRoot,
    cleanup: () => {
      process.chdir(ORIGINAL_CWD);
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
};

/** Init a git repo with one commit and a keep-out .gitignore (the dispatch's own
 *  `.kairos` writes and the fixture's synthetic docs stay out of the tree, so the
 *  clean-tree pre-flight gate judges the fixture's own edits alone). */
const gitInit = (repoRoot: string): void => {
  spawnSync("git", ["init", "-q"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.email", "preview@test"], { cwd: repoRoot });
  spawnSync("git", ["config", "user.name", "preview-test"], { cwd: repoRoot });
  writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n/docs/\n", "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
};

/** A one-task plan document — the wave face's dispatch input. */
const planFor = (repoRoot: string): string => {
  const file = path.join(repoRoot, "docs", "kairos", "plans", "p3.md");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: p3",
      "---",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "### Task 1: task 1",
      "- **Objective**: objective",
      "- **Files**: `a.ts`",
      "- **Consumes**: x",
      "- **Produces**: y",
      "- **Steps**:",
      "  - step — checkable: green",
      "- **Acceptance**: ok",
      "- **DependsOn**: none",
      "",
    ].join("\n"),
    "utf8",
  );
  return file;
};

const porcelain = (repoRoot: string): string =>
  spawnSync("git", ["status", "--porcelain"], { cwd: repoRoot }).stdout.toString();

const progressPath = (repoRoot: string): string =>
  path.join(repoRoot, ".kairos", "cdd", "p3", "progress.json");

describe("cdd <verb> --dry-run — the read-only preview", () => {
  it("writes nothing: `.kairos/` stays absent and the tree is byte-identical", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const before = porcelain(repoRoot);
      const code = await command.runArgv([
        "implement",
        "--tasks",
        "1",
        "--plan",
        plan,
        "--dry-run",
      ]);
      expect(code).toBe(0);
      expect(io.stdoutText.startsWith("cdd implement: preview (no repo changes)\n")).toBe(true);
      for (const label of ["step:", "reads:", "would write:", "would record:", "child:"])
        expect(io.stdoutText).toContain(`  ${label} `);
      // a preview fabricates no conclusion and no next hop
      expect(io.stdoutText).not.toContain("status:");
      expect(io.stdoutText).not.toContain("next:");
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
      expect(porcelain(repoRoot)).toBe(before);
    } finally {
      cleanup();
    }
  });

  it("consumes no round — the same line's real review still dispatches afterwards", async () => {
    const dispatch = async (): Promise<DispatchOutcome> => ({ status: "APPROVED", findings: [] });
    const { command, cleanup, repoRoot } = fixture({ dispatch });
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      expect(await command.runArgv(["implement", "--tasks", "1", "--plan", plan])).toBe(0);
      // the preview of the next round: no write, no ledger row
      expect(
        await command.runArgv([
          "review",
          "--type",
          "wave",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--dry-run",
        ]),
      ).toBe(0);
      expect(existsSync(path.join(repoRoot, ".kairos", "cdd", "p3", "tasks-1-review-1.json"))).toBe(
        false,
      );
      expect(JSON.parse(readFileSync(progressPath(repoRoot), "utf8")).waves).not.toContainEqual(
        expect.objectContaining({ rounds: { implement: [1], review: [1] } }),
      );
      // the real review of the SAME command dispatches immediately (nothing consumed)
      expect(
        await command.runArgv(["review", "--type", "wave", "--tasks", "1", "--plan", plan]),
      ).toBe(0);
      const progress = JSON.parse(readFileSync(progressPath(repoRoot), "utf8")) as {
        waves: { wave: string; rounds?: Record<string, number[]> }[];
      };
      expect(progress.waves.find((row) => row.wave === "1")?.rounds).toEqual({
        implement: [1],
        review: [1],
      });
    } finally {
      cleanup();
    }
  });

  it("a refused pre-flight renders the real run's refusal face verbatim and prints no preview", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      writeFileSync(path.join(repoRoot, "dirty.txt"), "dirty\n", "utf8");
      const argv = ["implement", "--tasks", "1", "--plan", plan];
      expect(await command.runArgv([...argv, "--dry-run"])).toBe(1);
      const previewStderr = io.stderrText;
      expect(io.stdoutText).not.toContain("preview");
      io.stdoutText = "";
      io.stderrText = "";
      expect(await command.runArgv(argv)).toBe(1);
      expect(io.stderrText).toBe(previewStderr);
    } finally {
      cleanup();
    }
  });

  it("is scoped to the pure commands — every one rejects the flag (exit 2)", async () => {
    const { command, io, cleanup } = fixture();
    try {
      const cases: readonly (readonly string[])[] = [
        ["schema", "get", "plan", "--dry-run"],
        ["base", "get", "--plan", "docs/x.md", "--dry-run"],
        [
          "base",
          "set",
          "--plan",
          "docs/x.md",
          "--base",
          "main",
          "--source",
          "plan-field",
          "--dry-run",
        ],
        ["issue", "render", "--dry-run"],
        ["board", "--plan", "docs/kairos/plans/p3.md", "--dry-run"],
      ];
      for (const argv of cases) {
        io.stderrText = "";
        expect(await command.runArgv([...argv])).toBe(2);
        expect(io.stderrText).toContain("--dry-run previews the next dispatch step");
      }
    } finally {
      cleanup();
    }
  });

  it("init previews its step plan — the would-run lines, zero spawn, zero writes (the fourth verb)", async () => {
    const runner = new RecordingRunner();
    const headers: string[] = [];
    const { command, repoRoot, cleanup } = fixture({
      initRunner: runner,
      initHeader: (line) => headers.push(line),
    });
    try {
      expect(await command.runArgv(["init", "--harness=claude", "--dry-run"])).toBe(0);
      expect(headers[0]).toBe(
        "would run: claude plugin marketplace add obra/superpowers-marketplace",
      );
      expect(headers.at(-1)).toBe("init: 6 steps (claude · install) — dry run, nothing executed");
      // the preview flag never installs anything and never touches the tree
      expect(runner.calls).toEqual([]);
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("a pre-verb --dry-run previews the bootstrap too — the pi denominator, zero spawn", async () => {
    const runner = new RecordingRunner();
    const headers: string[] = [];
    const { command, io, repoRoot, cleanup } = fixture({
      initRunner: runner,
      initHeader: (line) => headers.push(line),
    });
    try {
      // the flag is accepted at any position — ahead of the verb it merges from the
      // program node into the same preview face
      expect(await command.runArgv(["--dry-run", "init", "--harness=pi"])).toBe(0);
      expect(headers).toHaveLength(4);
      expect(headers[0]).toBe("would run: pi install git:github.com/obra/superpowers");
      expect(headers.at(-1)).toBe("init: 3 steps (pi · install) — dry run, nothing executed");
      expect(runner.calls).toEqual([]);
      expect(io.stderrText).toBe("");
      expect(existsSync(path.join(repoRoot, ".kairos"))).toBe(false);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P21 T6 — the in-flight read face and the orphan drafts (zero write)
// ---------------------------------------------------------------------------

/** The tree-level in-flight record path of a fixture repo. */
const recordPath = (repoRoot: string): string =>
  path.join(repoRoot, ".kairos", "cdd", "in-flight.json");

/** Write a standing in-flight record (the tree-level path). */
const writeRecord = (
  repoRoot: string,
  record: { pid: number; startedAt: number; dead?: boolean },
): void => {
  mkdirSync(path.join(repoRoot, ".kairos", "cdd"), { recursive: true });
  writeFileSync(
    recordPath(repoRoot),
    `${JSON.stringify(
      {
        pid: record.pid,
        pgid: record.pid,
        command: "cdd implement --tasks 1 --plan docs/kairos/plans/p3.md",
        slug: "p3",
        startedAt: record.startedAt,
        wave: "1",
        phase: "implement",
        briefHash: null,
        plan: "docs/kairos/plans/p3.md",
        sampledAt: null,
        verdict: null,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

/** The workspace directory's content + per-file mtimes (the orphan's zero-write pin). */
const workspaceSnapshot = (repoRoot: string): string => {
  const dir = path.join(repoRoot, ".kairos", "cdd", "p3");
  if (!existsSync(dir)) return "absent";
  return JSON.stringify(
    readdirSync(dir)
      .sort()
      .map((name) => [name, statSync(path.join(dir, name)).mtimeMs]),
  );
};

describe("cdd <verb> --dry-run — the in-flight read face", () => {
  it("prints the live holder as a `lock:` row and exits 1, touching neither the record nor the lock", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const startedAt = (await ProcessFacts.startOf(process.pid)) ?? Date.now();
      writeRecord(repoRoot, { pid: process.pid, startedAt });
      const recordBytes = readFileSync(recordPath(repoRoot), "utf8");
      const before = porcelain(repoRoot);

      expect(
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan, "--dry-run"]),
      ).toBe(1);
      expect(io.stdoutText).toContain("lock: held by pid");
      expect(io.stdoutText).toContain(String(process.pid));
      expect(io.stdoutText).not.toContain("--steal-stale");
      // the held preview reports the same checked face as the other dry-run shapes
      expect(io.stdoutText).toContain("checked:");
      expect(io.stdoutText).toContain("in-flight: held — pid");
      expect(readFileSync(recordPath(repoRoot), "utf8")).toBe(recordBytes);
      expect(existsSync(`${recordPath(repoRoot)}.lock`)).toBe(false);
      expect(porcelain(repoRoot)).toBe(before);
    } finally {
      cleanup();
    }
  });

  it("prints the takeover hint for a dead holder — `--steal-stale --dry-run` still takes nothing over", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      writeRecord(repoRoot, { pid: 999_999, startedAt: 1 });
      const recordBytes = readFileSync(recordPath(repoRoot), "utf8");

      expect(
        await command.runArgv([
          "implement",
          "--tasks",
          "1",
          "--plan",
          plan,
          "--steal-stale",
          "--dry-run",
        ]),
      ).toBe(1);
      expect(io.stdoutText).toContain("lock: held by pid 999999");
      expect(io.stdoutText).toContain("--steal-stale");
      // the same checked face as the other dry-run shapes
      expect(io.stdoutText).toContain("checked:");
      expect(io.stdoutText).toContain("in-flight: stale holder — pid 999999");
      // no takeover, no deletion, no lock: the flag has no write channel here
      expect(existsSync(recordPath(repoRoot))).toBe(true);
      expect(readFileSync(recordPath(repoRoot), "utf8")).toBe(recordBytes);
      expect(existsSync(`${recordPath(repoRoot)}.lock`)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("lists an orphan handoff draft on the `reads:` row and leaves the workspace untouched", async () => {
    const { command, io, repoRoot, cleanup } = fixture();
    try {
      gitInit(repoRoot);
      const plan = planFor(repoRoot);
      const dir = path.join(repoRoot, ".kairos", "cdd", "p3");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "tasks-1-review-1.json"),
        `${JSON.stringify({ findings: [] })}\n`,
        "utf8",
      );
      const before = workspaceSnapshot(repoRoot);

      expect(
        await command.runArgv(["implement", "--tasks", "1", "--plan", plan, "--dry-run"]),
      ).toBe(0);
      expect(io.stdoutText).toContain("orphan drafts: tasks-1-review-1.json");
      expect(workspaceSnapshot(repoRoot)).toBe(before);
    } finally {
      cleanup();
    }
  });
});
