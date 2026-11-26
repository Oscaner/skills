// packages/cdd-engine/src/env/process/__tests__/process.test.ts
// The process segment's pins:
//   · the process facts read a GROUP as one fact — a wrapper and the child it spawned
//     are one dispatch, not two — and an exited process reads as gone;
//   · the host is detected at most once per environment (a counting probe);
//   · the lock refuses a second holder by naming the standing one, and a released lock
//     is acquirable again;
//   · the host contract keeps the marker environment keys in ONE place, and both slash
//     forms of a reference key are derivable from the key;
//   · the clock is the only system-time reader in `src/**`, and its two formatting faces
//     answer the local day and the UTC ISO form of one epoch independently;
//   · the child seam never judges liveness: a child with no observer runs to its own
//     exit, and a child the injected judge stops is killed as a GROUP (no member
//     survives);
//   · `env/**` reaches none of the other three slices (import-face assertion).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { Env } from "../../index.ts";
import { type ChildRun, Terminator } from "../child-runner.ts";
import { Clock } from "../clock.ts";
import { DISPATCH, detectHost, HOST_IDS, HOSTS, REF_KEYS, REFS } from "../host.ts";
import { Lock, type LockHolder } from "../lock.ts";
import { ProcessFacts, type ProcRow } from "../proc.ts";

/** The engine package root — the `src/**` scan's basis. */
const ENGINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** A fixed instant — the clock pin's epoch (2026-01-15T00:30 local). */
const BOUNDARY = new Date(2026, 0, 15, 0, 30, 0, 0).getTime();

/** The holder facts a refused acquisition reports — the caller's own record shape. */
const HOLDER: LockHolder = { pid: 4242, command: "cdd implement", slug: "s1", startedAt: BOUNDARY };

/** The temp roots this file made, removed after every case. */
const created: string[] = [];

/** A fresh temp directory. */
const tempDir = (prefix: string): string => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  created.push(directory);
  return directory;
};

/** A temp directory initialised as a git working tree (`Env` resolves its basis there). */
const tempRepo = (prefix: string): string => {
  const directory = tempDir(prefix);
  spawnSync("git", ["init", "-q"], { cwd: directory });
  return directory;
};

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("the process facts", () => {
  it("reads a wrapper and its children as ONE group, not as several dispatches", () => {
    const rows: readonly ProcRow[] = [
      { pid: 10, ppid: 1, cmd: "zsh", startTime: 1_000 },
      { pid: 100, ppid: 10, cmd: "npm exec cdd", startTime: 2_000 },
      { pid: 101, ppid: 100, cmd: "node cdd", startTime: 2_100 },
      { pid: 102, ppid: 101, cmd: "pi -p", startTime: 2_200 },
    ];
    // One group, three members: the wrapper's dispatch is the group, so counting the
    // group counts the dispatch once.
    expect(ProcessFacts.groupMembers(100, rows)).toEqual([100, 101, 102]);
    // A member of the group is not a second group: the same table rooted anywhere
    // outside it answers a different set.
    expect(ProcessFacts.groupMembers(10, rows)).toEqual([10, 100, 101, 102]);
  });

  it("reads an exited process as gone, and an unreadable start time as untellable", async () => {
    const rows: readonly ProcRow[] = [
      { pid: 200, ppid: 1, cmd: "node cdd", startTime: BOUNDARY },
      { pid: 201, ppid: 1, cmd: "node stale", startTime: null },
    ];
    expect(await ProcessFacts.live(999, BOUNDARY, rows)).toBe(false);
    expect(await ProcessFacts.live(200, BOUNDARY, rows)).toBe(true);
    expect(await ProcessFacts.live(201, BOUNDARY, rows)).toBeNull();
    // A reused pid (a start instant far from the recorded one) is not the same process.
    expect(await ProcessFacts.live(200, BOUNDARY + 30_000, rows)).toBe(true);
    expect(await ProcessFacts.live(200, BOUNDARY - 10 * 60_000, rows)).toBe(false);
  });
});

describe("the host probe", () => {
  it("is read once per environment, whatever the number of reads", () => {
    const repo = tempRepo("proc-host-");
    let probes = 0;
    const env = new Env({
      cwd: repo,
      baseName: "base.json",
      hostProbe: (view) => {
        probes += 1;
        return detectHost(view);
      },
      hostEnv: { AI_AGENT: "pi" },
    });
    expect(env.process.host()).toBe("pi");
    expect(env.process.host()).toBe("pi");
    expect(probes).toBe(1);
  });

  it("answers the empty string when no marker is present, and detects once", () => {
    const probe = detectHost({});
    expect(probe).toBe("");
    expect(detectHost({ CLAUDE_CODE_SESSION_ID: "abc" })).toBe("claude");
    expect(detectHost({ AI_AGENT: "claude-code-1" })).toBe("claude");
  });
});

describe("the lock", () => {
  it("refuses a second holder by naming the standing one, and frees the target on release", async () => {
    const repo = tempDir("proc-lock-");
    const target = path.join(repo, "in-flight.json");
    const first = new Lock({ target, holderOf: () => HOLDER });
    expect(await first.acquire()).toEqual({ kind: "acquired" });
    expect(first.held).toBe(true);

    const second = new Lock({ target, holderOf: () => HOLDER });
    const refused = await second.acquire();
    expect(refused.kind).toBe("held");
    if (refused.kind !== "held") throw new Error("unreachable");
    expect(refused.holder?.pid).toBe(HOLDER.pid);
    expect(refused.holder?.command).toBe(HOLDER.command);

    await first.release();
    expect(first.held).toBe(false);
    expect(await second.acquire()).toEqual({ kind: "acquired" });
    await second.release();
    expect(readdirSync(repo).filter((name) => name.endsWith(".lock"))).toEqual([]);
  });
});

describe("the host contract", () => {
  it("keeps the host-marker environment keys in ONE place", () => {
    const scan = new Scan();
    expect(scan.filesUsing(["CLAUDE_CODE_SESSION_ID", "AI_AGENT"])).toEqual([
      "env/process/host.ts",
    ]);
    // The one copy is the detect column of the declared rows.
    expect(HOST_IDS.map((id) => HOSTS[id].detect.env).sort()).toEqual([
      "AI_AGENT",
      "CLAUDE_CODE_SESSION_ID",
    ]);
  });

  it("derives both slash forms of every reference key from the key", () => {
    expect(REF_KEYS.length).toBeGreaterThan(0);
    for (const key of REF_KEYS) {
      const bare = key.slice(key.indexOf(":") + 1);
      expect(REFS[key]).toEqual({ claude: `/${key}`, pi: `/skill:${bare}` });
    }
    // Every dispatched ref key is a registered key, so the table has no orphan slot.
    expect(REF_KEYS).toContain(DISPATCH.implement);
    expect(REF_KEYS).toContain(DISPATCH.review.wave.ref);
    expect(REF_KEYS).toContain(DISPATCH.review.branch.ref);
  });
});

describe("the clock", () => {
  it("is the only system-time reader in `src/**`", () => {
    const scan = new Scan();
    expect(scan.filesUsing(["Date.now", "new Date()"])).toEqual(["env/process/clock.ts"]);
  });

  it("answers the local day and the UTC ISO form of one epoch independently", () => {
    const clock = new Clock(() => BOUNDARY);
    // A frozen clock: two reads of the day agree, and the reading is the injected one.
    expect(clock.now()).toBe(BOUNDARY);
    expect(clock.dayOf(clock.now())).toBe(clock.dayOf(clock.now()));
    expect(clock.dayOf(BOUNDARY)).toBe("2026-01-15");
    expect(clock.isoOf(BOUNDARY)).toBe(new Date(BOUNDARY).toISOString());
    // The two faces are not slices of each other: on a machine whose UTC offset is not
    // zero, local 00:30 and the UTC date of that instant are different days.
    if (new Date(BOUNDARY).getTimezoneOffset() !== 0) {
      expect(clock.isoOf(BOUNDARY).slice(0, 10)).not.toBe(clock.dayOf(BOUNDARY));
    }
  });
});

describe("the child seam", () => {
  it("runs a child to its own exit when no judge is attached", async () => {
    const outcome = await new Terminator().run(childRun("process.stdout.write('done')"));
    expect(outcome.code).toBe(0);
    expect(outcome.stdout).toBe("done");
    expect(outcome.facts.stopped).toBe(false);
    expect(outcome.facts.overBudget).toBe(false);
  });

  it("stops the whole GROUP when the injected judge calls kill", async () => {
    let pgid = 0;
    const outcome = await new Terminator().run({
      ...childRun("setInterval(() => {}, 1000)"),
      observe: (child) => {
        pgid = child.pgid;
        expect(child.kill()).toBe(true);
      },
    });
    expect(outcome.facts.stopped).toBe(true);
    expect(outcome.code).toBeNull();
    // No member of the killed group survives — the group is one fact and it is gone.
    const survivors = await survivorsOf(pgid);
    expect(survivors).toEqual([]);
  }, 20_000);
});

describe("the segment boundary", () => {
  it("reaches none of the other three slices", () => {
    const offenders = new SpecifierScan().foreignReaches();
    expect(offenders).toEqual([]);
  });
});

/** One child run over the current node binary — the test's own command. */
const childRun = (script: string): ChildRun => ({
  command: process.execPath,
  args: ["-e", script],
  cwd: process.cwd(),
  env: {},
  budgetMs: 15_000,
});

/** The live members of one process group, polled for a bounded number of turns — a
 *  killed group's members are reaped asynchronously, so one read would race the kill. */
const survivorsOf = async (pgid: number): Promise<readonly number[]> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await ProcessFacts.snapshot();
    // `groupMembers` names the root unconditionally (the group of a leader the table no
    // longer carries is still "that group"), so survival is read off the table itself.
    const live = ProcessFacts.groupMembers(pgid, rows).filter((pid) =>
      rows.some((row) => row.pid === pid),
    );
    if (live.length === 0) return [];
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return [pgid];
};

/** The `src/**` scan: which non-test modules mention one of the given identifiers. */
class Scan {
  /** The `src`-relative paths whose non-test text mentions any needle. */
  filesUsing(needles: readonly string[]): string[] {
    const root = path.join(ENGINE_ROOT, "src");
    const found: string[] = [];
    this.#walk(root, root, needles, found);
    return found.sort();
  }

  /** Collect a directory's non-test TypeScript files, or test one file. */
  #walk(target: string, root: string, needles: readonly string[], found: string[]): void {
    const stats = statSync(target);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(target, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name === "__tests__") continue;
        this.#walk(path.join(target, entry.name), root, needles, found);
      }
      return;
    }
    if (!target.endsWith(".ts")) return;
    const text = readFileSync(target, "utf8");
    if (needles.some((needle) => text.includes(needle))) found.push(path.relative(root, target));
  }
}

/** The import-face scan: the relative specifiers of `src/env/**` that leave the slice. */
class SpecifierScan {
  /** One row per offending edge — `<file> -> <specifier>`, nothing when the slice is
   *  closed over itself and the layers below it. */
  foreignReaches(): string[] {
    const sliceRoot = path.join(ENGINE_ROOT, "src", "env");
    const forbidden = ["docs", "run", "surface"].map((name) => path.join(ENGINE_ROOT, "src", name));
    const offences: string[] = [];
    for (const file of this.#files(sliceRoot)) {
      for (const specifier of SpecifierScan.#specifiersIn(readFileSync(file, "utf8"))) {
        if (!specifier.startsWith(".")) continue;
        const resolved = path.resolve(path.dirname(file), specifier);
        if (
          forbidden.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))
        ) {
          offences.push(`${path.relative(ENGINE_ROOT, file)} -> ${specifier}`);
        }
      }
    }
    return offences;
  }

  /** Every non-test TypeScript file under one directory. */
  #files(directory: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") found.push(...this.#files(child));
        continue;
      }
      if (entry.name.endsWith(".ts")) found.push(child);
    }
    return found;
  }

  /** The module specifiers a file's text carries — static, re-export and dynamic forms. */
  static #specifiersIn(text: string): readonly string[] {
    const found: string[] = [];
    for (const match of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier !== undefined) found.push(specifier);
    }
    return found;
  }
}
