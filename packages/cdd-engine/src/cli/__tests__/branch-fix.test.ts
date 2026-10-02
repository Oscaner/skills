// packages/cdd-engine/src/cli/__tests__/branch-fix.test.ts
// Task 9 (spec E2①): `cdd fix --type branch` — the branch-level review→fix loop's fix channel.
//   ① dry-run through the merged single CLI → APPROVED stub branch-fix-{base7}..{head7}-r{R}.json + return block;
//   ② usage guards: missing --plan / missing --findings / non-matching findings name → exit 2;
//   ③ in-process loop closure: a source review handoff (branch-review-{base7}..{head7}-r1.json) →
//      runBranchFix with a ghost fake-cli (writes the fix handoff + an empty fix commit) → the fix
//      writes branch-fix-{base7}..{head7}-r1.json with commits.base = the review's base (the fix's
//      FIX_BASE) and passes the exit gate; the fix commit moves HEAD → the next branch-review reads a
//      NEW ref → resolveNextRound returns round 1 (ref-moved = legal re-review — the Convergence law).
// T10 warn (mirrors branch-review.test.ts): fixture plan/workspace in a tmp git repo — never the
// real repo's .kairos/cdd/.

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execaSync } from "execa";
import { describe, expect, it } from "vitest";

import { captureStdout, writeBranchChain } from "../../infra/__tests__/helpers.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", ".."); // tests → packages/cdd-engine → packages → repo

function tmpGitRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-bf-"));
  execaSync("git", ["-C", dir, "init", "-q"]);
  execaSync("git", [
    "-C",
    dir,
    "-c",
    "user.name=cdd-test",
    "-c",
    "user.email=cdd-test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  ]);
  return dir;
}

const FULL_ID = (c: string) => c.repeat(40);

// ---- ① dry-run (merged single CLI, host harness from the ambient env) ----
describe("branch-fix dry-run", () => {
  it("writes APPROVED branch-fix handoff + the 5-line return block (status/commits/artifacts + counters + next)", () => {
    const dir = tmpGitRepo();
    const slug = "test-plan-bf";
    const planPath = writeBranchChain(dir, `${slug}.md`);
    const findingsPath = path.join(
      dir,
      ".kairos",
      "cdd",
      slug,
      "branch-review-abc1234..def5678-r1.json",
    );
    const handoffPath = path.join(
      dir,
      ".kairos",
      "cdd",
      slug,
      "branch-fix-abc1234..def5678-r1.json",
    );

    try {
      const out = execaSync(
        "node",
        [
          path.join(REPO_ROOT, "packages/cdd-engine/dist/cli.mjs"),
          "--dry-run",
          "fix",
          "--type",
          "branch",
          "--plan",
          planPath,
          "--findings",
          findingsPath,
        ],
        { cwd: dir, env: { ...process.env, CLAUDE_CODE_SESSION_ID: "1" }, encoding: "utf8" },
      ).stdout;

      expect(out).toContain("status: COMPLETED"); // fix work axis (T3): the dry-run fix round concludes COMPLETED
      expect(out).toContain("· blocker: 0 ·"); // zero input findings → the decision-source blocker count 0
      expect(out).toContain("· handoff:"); // the capsule points at the carrier (commits live there)
      expect(out).toContain("next: none"); // C5 (T8): dry-run fix has zero input findings → closure
      expect(out).not.toContain("counters:"); // no 4-line block on stdout (T3)
      expect(existsSync(handoffPath)).toBe(true);

      const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
      expect(handoff).toHaveProperty("status", "APPROVED");
      expect(handoff).toHaveProperty("phase", "fix");
      expect(handoff).toHaveProperty("commits");
      expect(handoff).toHaveProperty("findings");
      expect(handoff).not.toHaveProperty("blocker"); // the blocker field is no longer written (M3)
      expect(handoff).not.toHaveProperty("doc_path");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ② usage guards (exit 2) ----
describe("branch-fix usage guards", () => {
  const runCli = (args: string[]) => {
    const dir = tmpGitRepo();
    const planPath = writeBranchChain(dir, "test-plan-guard.md");
    const findingsPath = path.join(
      dir,
      ".kairos",
      "cdd",
      "test-plan-guard",
      "branch-review-abc1234..def5678-r1.json",
    );
    let r: { exitCode: number; stderr: string; stdout: string } | null = null;
    try {
      try {
        execaSync(
          "node",
          [
            path.join(REPO_ROOT, "packages/cdd-engine/dist/cli.mjs"),
            "--dry-run",
            "fix",
            "--type",
            "branch",
            ...args,
          ].map((x) => (x === "<PLAN>" ? planPath : x === "<FINDINGS>" ? findingsPath : x)),
          { cwd: dir, env: { ...process.env, CLAUDE_CODE_SESSION_ID: "1" }, encoding: "utf8" },
        );
      } catch (e: any) {
        r = { exitCode: e.exitCode ?? 1, stderr: e.stderr ?? "", stdout: e.stdout ?? "" };
      }
      return r ?? { exitCode: 0, stderr: "", stdout: "" };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("missing --plan → exit 2", () => {
    const r = runCli(["--findings", "<FINDINGS>"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/missing required --plan/);
  });

  it("missing --findings → exit 2", () => {
    const r = runCli(["--plan", "<PLAN>"]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/missing required --findings/);
  });

  it("--findings not naming a branch-review-{base7}..{head7}-r{R}.json file → exit 2 (round underivable)", () => {
    const dir = tmpGitRepo();
    const planPath = writeBranchChain(dir, "test-plan-guard.md");
    const badFindings = path.join(dir, "spec-review-3.json");
    try {
      let exitCode: number | null = null;
      try {
        execaSync(
          "node",
          [
            path.join(REPO_ROOT, "packages/cdd-engine/dist/cli.mjs"),
            "--dry-run",
            "fix",
            "--type",
            "branch",
            "--plan",
            planPath,
            "--findings",
            badFindings,
          ],
          { cwd: dir, env: { ...process.env, CLAUDE_CODE_SESSION_ID: "1" }, encoding: "utf8" },
        );
      } catch (e: any) {
        exitCode = e.exitCode ?? 1;
      }
      expect(exitCode).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ③ in-process loop closure (ghost registry + fake-cli; mirrors branch-review.test.ts e2e) ----
describe("branch-fix in-process loop closure", () => {
  it("fixes off the source review handoff (commits.base = reviewed range), passes the exit gate, and the fix commit moves the ref → re-review of the new ref is a new review", async () => {
    const dir = tmpGitRepo();
    const slug = "test-plan-bf";
    const planPath = writeBranchChain(dir, `${slug}.md`);
    // The exit gate (validateCommitContract) rules at RETURN: a dirty tree → BLOCKED rewrite.
    // Everything the fake agent + this test write after setup must be gitignored
    // (`.kairos/` handoffs + `*.head` probe), and everything else committed as fixtures.
    writeFileSync(path.join(dir, ".gitignore"), ".kairos/\n*.head\n");
    const base = FULL_ID("a");
    const head = FULL_ID("b");
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    const { Handoff } = await import("../../artifacts/handoff.ts");
    const { WorkspaceRoot } = await import("../../infra/workspace.ts");
    const workspace = WorkspaceRoot.from(dir).for(planPath).path;
    const reviewPath = path.join(
      workspace,
      Handoff.handoffName("review", "branch", { base7, head7, round: 1 }),
    );
    const handoffPath = path.join(
      workspace,
      Handoff.handoffName("fix", "branch", { base7, head7, round: 1 }),
    );
    mkdirSync(workspace, { recursive: true });
    // The source review handoff the fix reads: --findings IS the review handoff (same file).
    writeFileSync(
      reviewPath,
      JSON.stringify({
        tasks: [1],
        phase: "branch-review",
        status: "APPROVED",
        commits: { base, head },
        findings: [],
        artifacts: {},
      }),
    );
    // fake-cli fix agent: writes the fix handoff (commits.base = reviewed range base, head = git HEAD
    // after its own commit) then creates the fix commit — the real agent's atomic fix+commit behavior.
    const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bf-fake-"));
    writeFileSync(
      path.join(binDir, "fake-cli"),
      `#!/usr/bin/env bash\n` +
        `git commit --allow-empty -qm "fix"\n` +
        `HEAD=$(git rev-parse HEAD)\n` +
        `cat > "${handoffPath}" <<EOF\n` +
        `{"tasks":[1],"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"$HEAD"},"findings":[],"artifacts":{}}\n` +
        `EOF\n` +
        `git rev-parse HEAD > "${path.join(dir, "fix-after-commit.head")}"\n` +
        `exit 0\n`,
    );
    chmodSync(path.join(binDir, "fake-cli"), 0o755);
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    const { REG_PATH } = await import("../../infra/registry.ts");
    const regPath = path.join(dir, "registry.json");
    const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
    reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    // Commit the fixtures (plan + .gitignore + ghost registry) ONCE — the clean-tree exit gate
    // later requires zero non-ignored untracked/modified files at return.
    execaSync("git", ["-C", dir, "add", "-A"]);
    execaSync("git", [
      "-C",
      dir,
      "-c",
      "user.name=cdd-test",
      "-c",
      "user.email=cdd-test@example.com",
      "commit",
      "-qm",
      "fixtures",
    ]);
    try {
      const { ExitRequested, exitWithCode } = await import("../../infra/exit.ts");
      const { DispatchBlocked } = await import("../../dispatch/base.ts");
      const { BranchFixLifecycle } = await import("../../dispatch/branch.ts");
      let exitCode: number | null = null;
      try {
        const fxDryRun = false;
        const lc = new BranchFixLifecycle({
          harness: "ghost",
          plan: planPath,
          findings: reviewPath,
          root: dir,
          registryPath: regPath,
          dryRun: fxDryRun,
          ctx: { mode: "fix", repoRoot: dir, dryRun: fxDryRun },
        });
        try {
          await lc.run();
        } catch (e) {
          if (e instanceof DispatchBlocked && e.gate === "exit") {
            process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
            exitWithCode(1);
          }
          throw e;
        }
        exitWithCode(lc.exitCode);
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      // The fix round completed cleanly: runBranchFix lands on exitOk() → ExitRequested(0)
      // (exit gate passed: fake commit → clean tree + handoff head matches actual HEAD).
      expect(exitCode).toBe(0);

      const h = JSON.parse(readFileSync(handoffPath, "utf8"));
      expect(h.phase).toBe("fix");
      expect(h.status).toBe("APPROVED");
      // commits.base = the reviewed range base (FIXED_POINT); head = the fix's own HEAD.
      expect(h.commits.base).toBe(base);
      // The fake agent committed — the new HEAD is a NEW ref.
      const newHead = readFileSync(path.join(dir, "fix-after-commit.head"), "utf8").trim();
      const newHead7 = newHead.slice(0, 7);
      expect(newHead).not.toBe(head);

      // Ref-moved = new review: a branch-review on the NEW ref resolves round 1 (never falsely
      // stopped by the old ref's APPROVED round) — the BASE..HEAD Convergence law.
      expect(
        Handoff.resolveNextRound(workspace, "review", "branch", { base7, head7: newHead7 }),
      ).toBe(1);
      // The OLD ref keeps its own lineage: round 2 (the fix consumed nothing from the review
      // sequence — same-ref re-review remains a continuation, Convergence decides at dispatch).
      expect(Handoff.resolveNextRound(workspace, "review", "branch", { base7, head7 })).toBe(2);
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ③-bis real-mode stdout return block (T9 finding): BranchFixLifecycle's real-mode channel
// previously emitted NO stdout — the normalizeResult deriveFixNext + the wrapper's returnBlock
// emission surface the C5-1 fix-face result line (blocker input → re-review on the moved ref;
// warn/nit → closure; the return block prints status/commits/artifacts + counters + next) ----
describe("branch-fix real-mode — parent stdout return block (C5-1 fix face)", () => {
  const setup = async (findings: Array<{ severity: string; summary?: string }>) => {
    const dir = tmpGitRepo();
    const slug = "test-plan-bf-rb";
    const planPath = writeBranchChain(dir, `${slug}.md`);
    writeFileSync(path.join(dir, ".gitignore"), ".kairos/\n*.head\n");
    const base = FULL_ID("a");
    const head = FULL_ID("b");
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    const { Handoff } = await import("../../artifacts/handoff.ts");
    const { WorkspaceRoot } = await import("../../infra/workspace.ts");
    const workspace = WorkspaceRoot.from(dir).for(planPath).path;
    const reviewPath = path.join(
      workspace,
      Handoff.handoffName("review", "branch", { base7, head7, round: 1 }),
    );
    const handoffPath = path.join(
      workspace,
      Handoff.handoffName("fix", "branch", { base7, head7, round: 1 }),
    );
    mkdirSync(workspace, { recursive: true });
    // The source review's findings are the C5-1 `--findings` INPUT the fix face judges on.
    writeFileSync(
      reviewPath,
      JSON.stringify({
        tasks: [1],
        phase: "branch-review",
        status: "CHANGES_REQUESTED",
        commits: { base, head },
        findings,
        artifacts: {},
      }),
    );
    const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bf-rb-fake-"));
    writeFileSync(
      path.join(binDir, "fake-cli"),
      `#!/usr/bin/env bash\n` +
        `git commit --allow-empty -qm "fix"\n` +
        `HEAD=$(git rev-parse HEAD)\n` +
        `cat > "${handoffPath}" <<EOF\n` +
        `{"tasks":[1],"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"$HEAD"},"findings":[],"artifacts":{"report":"/tmp/fix-report.md"}}\n` +
        `EOF\n` +
        `git rev-parse HEAD > "${path.join(dir, "fix-after-commit.head")}"\n` +
        `exit 0\n`,
    );
    chmodSync(path.join(binDir, "fake-cli"), 0o755);
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    const { REG_PATH } = await import("../../infra/registry.ts");
    const regPath = path.join(dir, "registry.json");
    const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
    reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    execaSync("git", ["-C", dir, "add", "-A"]);
    execaSync("git", [
      "-C",
      dir,
      "-c",
      "user.name=cdd-test",
      "-c",
      "user.email=cdd-test@example.com",
      "commit",
      "-qm",
      "fixtures",
    ]);
    return { dir, planPath, reviewPath, handoffPath, base, head, regPath, origPath };
  };

  const run = async (dir: string, planPath: string, reviewPath: string, regPath: string) => {
    const { ExitRequested, exitWithCode } = await import("../../infra/exit.ts");
    const { DispatchBlocked } = await import("../../dispatch/base.ts");
    const { BranchFixLifecycle } = await import("../../dispatch/branch.ts");
    // Mirror the cli/fix.ts branch channel exactly: run() (exit gate inside) → the wrapper emits
    // the lifecycle's returnBlock lines → exitWithCode.
    let exitCode: number | null = null;
    try {
      const fxDryRun = false;
      const lc = new BranchFixLifecycle({
        harness: "ghost",
        plan: planPath,
        findings: reviewPath,
        root: dir,
        registryPath: regPath,
        dryRun: fxDryRun,
        ctx: { mode: "fix", repoRoot: dir, dryRun: fxDryRun },
      });
      try {
        await lc.run();
      } catch (e) {
        if (e instanceof DispatchBlocked && e.gate === "exit") {
          process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
          exitWithCode(1);
        }
        throw e;
      }
      for (const line of lc.returnBlock) process.stdout.write(`${line}\n`);
      exitWithCode(lc.exitCode);
    } catch (e) {
      if (e instanceof ExitRequested) exitCode = e.code;
      else throw e;
    }
    return exitCode;
  };

  it("source review with a blocker finding → the fix face next: routes a re-review on the moved ref", async () => {
    const { dir, planPath, reviewPath, handoffPath, base, regPath, origPath } = await setup([
      { severity: "blocker", summary: "block me" },
    ]);
    const cap = captureStdout();
    try {
      const exitCode = await run(dir, planPath, reviewPath, regPath);
      expect(exitCode).toBe(0);
      const newHead = readFileSync(path.join(dir, "fix-after-commit.head"), "utf8").trim();
      // The fix round's stdout is the single capsule — work axis COMPLETED + the decision-source
      // blocker (the source review's blocker count) + the carrier pointer (T3).
      expect(cap.text).toContain("status: COMPLETED");
      expect(cap.text).toContain("· blocker: 1 ·"); // the source review carries one blocker finding
      expect(cap.text).toContain("· handoff:");
      expect(cap.text).not.toContain("counters:");
      // C5-1: the fix face derives the next hop from the --findings INPUT — blocker present →
      // re-review on the moved ref (base = the reviewed range base, head = the fix's git HEAD).
      expect(cap.text).toContain(
        `next: cdd review --type branch --plan ${planPath} --base ${base} --head ${newHead}`,
      );
      expect(existsSync(handoffPath)).toBe(true);
    } finally {
      process.env.PATH = origPath;
      cap.restore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("source review with warn/nit findings → closure `next: none`", async () => {
    const { dir, planPath, reviewPath, handoffPath, regPath, origPath } = await setup([
      { severity: "warn" },
      { severity: "nit" },
    ]);
    const cap = captureStdout();
    try {
      const exitCode = await run(dir, planPath, reviewPath, regPath);
      expect(exitCode).toBe(0);
      expect(cap.text).toContain("status: COMPLETED");
      expect(cap.text).toContain("· blocker: 0 ·"); // warn/nit input → zero decision-source blockers
      expect(cap.text).toContain("· handoff:");
      expect(cap.text).toContain("next: none"); // warn/nit-only input → closure round naturalization
      expect(cap.text).not.toContain("counters:");
      expect(existsSync(handoffPath)).toBe(true);
    } finally {
      process.env.PATH = origPath;
      cap.restore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ④ exit gate (commit contract) — dirty-tree BLOCKED carrier rewrite; C4-1 the head-mismatch
// lane retires (the engine stamps commits.head from git facts, the F1 mis-stamp is impossible) ----
describe("branch-fix exit gate — dirty tree → inherited commit-contract BLOCKED rewrite + C4-1 head facts", () => {
  const setup = async () => {
    const dir = tmpGitRepo();
    const slug = "test-plan-bf-gate";
    const planPath = writeBranchChain(dir, `${slug}.md`);
    // The exit gate rules at RETURN: a dirty tree rewrites the fix handoff to BLOCKED and exits 1
    // (the engine facts the commits head, so the only remaining commit-contract blot is the tree).
    // Everything the fake agent writes after setup must be gitignored (`.kairos/` handoffs +
    // `*.head` probes), and everything else committed as fixtures.
    writeFileSync(path.join(dir, ".gitignore"), ".kairos/\n*.head\n");
    const base = FULL_ID("a");
    const head = FULL_ID("b");
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    const { Handoff } = await import("../../artifacts/handoff.ts");
    const { WorkspaceRoot } = await import("../../infra/workspace.ts");
    const workspace = WorkspaceRoot.from(dir).for(planPath).path;
    const reviewPath = path.join(
      workspace,
      Handoff.handoffName("review", "branch", { base7, head7, round: 1 }),
    );
    const handoffPath = path.join(
      workspace,
      Handoff.handoffName("fix", "branch", { base7, head7, round: 1 }),
    );
    mkdirSync(workspace, { recursive: true });
    // The source review handoff the fix reads: --findings IS the review handoff (same file).
    writeFileSync(
      reviewPath,
      JSON.stringify({
        tasks: [1],
        phase: "branch-review",
        status: "APPROVED",
        commits: { base, head },
        findings: [],
        artifacts: {},
      }),
    );
    return { dir, planPath, reviewPath, handoffPath, base, head };
  };

  // Ghost registry + PATH fake-cli (same harness shape as the loop-closure lane); `script` is the
  // fake agent's bash body, run with the repo root as cwd.
  const installFakeCli = async (dir: string, script: string) => {
    const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bf-fake-"));
    writeFileSync(path.join(binDir, "fake-cli"), `#!/usr/bin/env bash\n${script}`);
    chmodSync(path.join(binDir, "fake-cli"), 0o755);
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    const { REG_PATH } = await import("../../infra/registry.ts");
    const regPath = path.join(dir, "registry.json");
    const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
    reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    // Commit the fixtures (plan + .gitignore + ghost registry) ONCE — the clean-tree exit gate
    // later requires zero non-ignored untracked/modified files at return.
    execaSync("git", ["-C", dir, "add", "-A"]);
    execaSync("git", [
      "-C",
      dir,
      "-c",
      "user.name=cdd-test",
      "-c",
      "user.email=cdd-test@example.com",
      "commit",
      "-qm",
      "fixtures",
    ]);
    return { origPath, regPath };
  };

  it("C4-1: agent 声明的坏 commits.head → engine 事实重造 stamp 真实 HEAD → 收据自愈 APPROVED（head 为机器事实，F1 硬闸收口于事实重造）", async () => {
    const { dir, planPath, reviewPath, handoffPath, base } = await setup();
    // A 40-hex ref that is NOT the repo HEAD — the agent declared a different commit than it made.
    // Under C4 the engine is the carrier's sole author: commits.head is a git fact (never the
    // agent's byte), so this receipt self-heals instead of F1-blocking — the head-mismatch lane
    // retires on the branch face (the engine cannot mis-stamp; the dirty-tree lane below remains).
    const wrongHead = FULL_ID("c");
    const { origPath, regPath } = await installFakeCli(
      dir,
      `cat > "${handoffPath}" <<EOF\n` +
        `{"tasks":[1],"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"${wrongHead}"},"findings":[],"artifacts":{}}\n` +
        `EOF\n` +
        `exit 0\n`,
    );
    try {
      const { ExitRequested, exitWithCode } = await import("../../infra/exit.ts");
      const { DispatchBlocked } = await import("../../dispatch/base.ts");
      const { BranchFixLifecycle } = await import("../../dispatch/branch.ts");
      let exitCode: number | null = null;
      try {
        const fxDryRun = false;
        const lc = new BranchFixLifecycle({
          harness: "ghost",
          plan: planPath,
          findings: reviewPath,
          root: dir,
          registryPath: regPath,
          dryRun: fxDryRun,
          ctx: { mode: "fix", repoRoot: dir, dryRun: fxDryRun },
        });
        try {
          await lc.run();
        } catch (e) {
          if (e instanceof DispatchBlocked && e.gate === "exit") {
            process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
            exitWithCode(1);
          }
          throw e;
        }
        exitWithCode(lc.exitCode);
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      // C4-1: the receipt self-heals — the engine re-authored commits (base = FIX_BASE, head =
      // actual git HEAD); clean tree + engine-stamped head pass the exit gate.
      expect(exitCode).toBe(0);
      const h = JSON.parse(readFileSync(handoffPath, "utf8"));
      expect(h.status).toBe("APPROVED");
      expect(h.commits.base).toBe(base); // the FIX_BASE survives as the git-fact base
      expect(h.commits.head).not.toBe(wrongHead); // the agent's claimed head is not the receipt's
      const actualHead = execaSync("git", ["-C", dir, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).stdout.trim();
      expect(h.commits.head).toBe(actualHead); // git HEAD is the machine fact
      expect(h.blocker).toBeUndefined();
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("dirty tree at return → exit 1 + on-disk fix handoff rewritten to BLOCKED carrier", async () => {
    const { dir, planPath, reviewPath, handoffPath, base } = await setup();
    const { origPath, regPath } = await installFakeCli(
      dir,
      `git commit --allow-empty -qm "fix"\n` +
        `HEAD=$(git rev-parse HEAD)\n` +
        `cat > "${handoffPath}" <<EOF\n` +
        `{"tasks":[1],"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"$HEAD"},"findings":[],"artifacts":{}}\n` +
        `EOF\n` +
        `printf 'dirty\\n' > "${dir}/dirty.tmp"\n` +
        `exit 0\n`,
    );
    try {
      const { ExitRequested, exitWithCode } = await import("../../infra/exit.ts");
      const { DispatchBlocked } = await import("../../dispatch/base.ts");
      const { BranchFixLifecycle } = await import("../../dispatch/branch.ts");
      let exitCode: number | null = null;
      try {
        const fxDryRun = false;
        const lc = new BranchFixLifecycle({
          harness: "ghost",
          plan: planPath,
          findings: reviewPath,
          root: dir,
          registryPath: regPath,
          dryRun: fxDryRun,
          ctx: { mode: "fix", repoRoot: dir, dryRun: fxDryRun },
        });
        try {
          await lc.run();
        } catch (e) {
          if (e instanceof DispatchBlocked && e.gate === "exit") {
            process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
            exitWithCode(1);
          }
          throw e;
        }
        exitWithCode(lc.exitCode);
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      expect(exitCode).toBe(1);
      // The dirty-tree BLOCKED carrier rewrite: the on-disk fix handoff now carries the engine's
      // BLOCKED conclusion (not the agent's declared APPROVED) + the dirty-tree blocker.
      const h = JSON.parse(readFileSync(handoffPath, "utf8"));
      expect(h.status).toBe("BLOCKED");
      expect(h.blocker).toMatch(/uncommitted changes at return/);
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("C4-1 no-root path: getRoot() fallback (initRoot primed like bin.ts:87) 的解析 root 仍喂 finalizeFix 的 head 事实 → 收据自愈 APPROVED + commits.head == 真实 HEAD", async () => {
    const { dir, planPath, reviewPath, handoffPath, base } = await setup();
    // The CLI wrapper seeds ctx.repoRoot = opts.root ?? null while fixCmd/reviewCmd declare no
    // --root, so on the real black-box walk the channel resolves its root from getRoot() (the
    // initRoot()-initialized singleton). This lane replicates that walk: initRoot primed like
    // bin.ts:87 — the resolveContext resolution (repoRoot) must still feed the C4 reconstruction's
    // head stamp (finalizeFix cds git HEAD off the resolved root; before the threading the root
    // stayed null → no head fact → no commit-contract basis).
    const wrongHead = FULL_ID("c"); // the agent's byte is not the receipt's git fact
    const { origPath, regPath } = await installFakeCli(
      dir,
      `cat > "${handoffPath}" <<EOF\n` +
        `{"tasks":[1],"phase":"fix","status":"APPROVED","commits":{"base":"${base}","head":"${wrongHead}"},"findings":[],"artifacts":{}}\n` +
        `EOF\n` +
        `exit 0\n`,
    );
    try {
      const { ExitRequested } = await import("../../infra/exit.ts");
      const { initRoot } = await import("../../infra/root.ts");
      const { DispatchBlocked } = await import("../../dispatch/base.ts");
      const { BranchFixLifecycle } = await import("../../dispatch/branch.ts");
      const { exitWithCode } = await import("../../infra/exit.ts");
      await initRoot(dir);
      let exitCode: number | null = null;
      try {
        const fxDryRun = false;
        const lc = new BranchFixLifecycle({
          harness: "ghost",
          plan: planPath,
          findings: reviewPath,
          root: dir,
          registryPath: regPath,
          dryRun: fxDryRun,
          ctx: { mode: "fix", repoRoot: dir, dryRun: fxDryRun },
        });
        try {
          await lc.run();
        } catch (e) {
          if (e instanceof DispatchBlocked && e.gate === "exit") {
            process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
            exitWithCode(1);
          }
          throw e;
        }
        exitWithCode(lc.exitCode);
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      expect(exitCode).toBe(0); // C4-1 self-heal: no F1 hard gate on the branch face
      const h = JSON.parse(readFileSync(handoffPath, "utf8"));
      expect(h.status).toBe("APPROVED");
      expect(h.commits.head).not.toBe(wrongHead); // the agent's claimed head is replaced by the machine fact
      const actualHead = execaSync("git", ["-C", dir, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).stdout.trim();
      expect(h.commits.head).toBe(actualHead); // the resolved root fed the head stamp
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ⑤ C4-3 (T7): still-failing schema-invalid receipt (following #306's guidance call) — the
// blocker carries the bad FIELD NAME + the EXPECTED SHAPE, so the authing agent knows the writable
// contract ----
describe("branch-fix schema-invalid receipt — C4-3 blocker has field name + expected shape", () => {
  it("notes 类型违规 → exit 1 + BLOCKED carrier 的 blocker 附坏字段名（notes）+ 期望形态 + 修后重跑同句", async () => {
    const dir = tmpGitRepo();
    const slug = "test-plan-bf-c43";
    const planPath = writeBranchChain(dir, `${slug}.md`);
    writeFileSync(path.join(dir, ".gitignore"), ".kairos/\n*.head\n");
    const base = FULL_ID("a");
    const head = FULL_ID("b");
    const base7 = base.slice(0, 7);
    const head7 = head.slice(0, 7);
    const { Handoff } = await import("../../artifacts/handoff.ts");
    const { WorkspaceRoot } = await import("../../infra/workspace.ts");
    const workspace = WorkspaceRoot.from(dir).for(planPath).path;
    const reviewPath = path.join(
      workspace,
      Handoff.handoffName("review", "branch", { base7, head7, round: 1 }),
    );
    const handoffPath = path.join(
      workspace,
      Handoff.handoffName("fix", "branch", { base7, head7, round: 1 }),
    );
    mkdirSync(workspace, { recursive: true });
    writeFileSync(
      reviewPath,
      JSON.stringify({
        tasks: [1],
        phase: "branch-review",
        status: "APPROVED",
        commits: { base, head },
        findings: [],
        artifacts: {},
      }),
    );
    // A declared-but-wrong-shape key (notes: 5 — not an unknown key, so normalization cannot
    // strip it) → the recovery still fails → the C4-3 still-failing face fires.
    const binDir = mkdtempSync(path.join(tmpdir(), "cdd-bf-fake-c43-"));
    writeFileSync(
      path.join(binDir, "fake-cli"),
      `#!/usr/bin/env bash\n` +
        `cat > "${handoffPath}" <<EOF\n` +
        `{"tasks":[1],"phase":"fix","status":"APPROVED","notes":5,"commits":{"base":"${base}","head":"${head}"},"findings":[],"artifacts":{}}\n` +
        `EOF\n` +
        `exit 0\n`,
    );
    chmodSync(path.join(binDir, "fake-cli"), 0o755);
    const origPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    const { REG_PATH } = await import("../../infra/registry.ts");
    const regPath = path.join(dir, "registry.json");
    const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
    reg.ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
    writeFileSync(regPath, JSON.stringify(reg, null, 2));
    execaSync("git", ["-C", dir, "add", "-A"]);
    execaSync("git", [
      "-C",
      dir,
      "-c",
      "user.name=cdd-test",
      "-c",
      "user.email=cdd-test@example.com",
      "commit",
      "-qm",
      "fixtures",
    ]);
    try {
      const { ExitRequested, exitWithCode } = await import("../../infra/exit.ts");
      const { DispatchBlocked } = await import("../../dispatch/base.ts");
      const { BranchFixLifecycle } = await import("../../dispatch/branch.ts");
      let exitCode: number | null = null;
      try {
        const fxDryRun = false;
        const lc = new BranchFixLifecycle({
          harness: "ghost",
          plan: planPath,
          findings: reviewPath,
          root: dir,
          registryPath: regPath,
          dryRun: fxDryRun,
          ctx: { mode: "fix", repoRoot: dir, dryRun: fxDryRun },
        });
        try {
          await lc.run();
        } catch (e) {
          if (e instanceof DispatchBlocked && e.gate === "exit") {
            process.stderr.write(`CDD_BLOCKED: ${e.message}\n`);
            exitWithCode(1);
          }
          throw e;
        }
        exitWithCode(lc.exitCode);
      } catch (e) {
        if (e instanceof ExitRequested) exitCode = e.code;
        else throw e;
      }
      expect(exitCode).toBe(1);
      const h = JSON.parse(readFileSync(handoffPath, "utf8"));
      expect(h.status).toBe("BLOCKED");
      const blocker = h.blocker as string;
      // field name — the recovery reason carries the violating key's validation detail
      expect(blocker).toMatch(/notes/);
      // expected shape — the writable-contract guidance (C4-3, following #306)
      expect(blocker).toMatch(/expected|shape/i);
      expect(blocker).toMatch(/status|findings|artifacts|commits/);
      // same sentence keeps the fix-and-re-run guidance
      expect(blocker).toMatch(/fix the handoff|re-run .*cdd fix --type branch/);
    } finally {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
