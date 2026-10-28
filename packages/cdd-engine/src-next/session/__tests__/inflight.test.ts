// packages/cdd-engine/src-next/session/__tests__/inflight.test.ts
// The InFlight suite (P21 §2.2) — the ONE in-flight fact of a work tree:
//   · acquire writes the intent record BEFORE the child exists, under the namespace's
//     own keep-out marker (a fresh namespace is never dirtied by a dispatch);
//   · the write order is lock-then-record: a refused second acquire leaves the
//     standing holder's bytes untouched (a challenger never overwrites a live holder);
//   · the lock is tree-level, so a different slug hits the same exclusion;
//   · release removes record + lock; a crash leaves the record standing (the
//     postmortem fact), and `inspect` reports the holder's liveness;
//   · an unreadable record is the `corrupt` state, with the leftover lock as its only
//     corroborating fact; `steal` refuses a live holder and clears a dead/corrupt one;
//   · `alive` is `ProcessFacts.live`'s judgment — an unreadable start time folds to
//     true (never an authorized takeover), a reused pid reads dead;
//   · `stealStale` acts inside acquire only: a dead holder is taken over, a live one
//     still refuses;
//   · the sampling trail is fail-open on both sides: an unwritable record write is
//     swallowed by `heartbeat` while `acquire`'s own record write stays loud.
// Every fixture is a fresh temp repo; the real process table is the default reader,
// an injected reader covers the unreadable-start-time branch.

import { execFileSync } from "node:child_process";
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
import { afterEach, describe, expect, it } from "vitest";
import { ProcessFacts } from "../../infra/proc.ts";
import { WorkspaceRoot } from "../../infra/workspace.ts";
import {
  HoldingError,
  InFlight,
  type InFlightRecord,
  type InFlightState,
  type LivenessReader,
} from "../inflight.ts";

const roots: string[] = [];

/** A fresh temp repo (removed after each case). */
const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "inflight-"));
  roots.push(dir);
  return dir;
};

/** One InFlight over a scratch repo's default namespace. */
const inflightOf = (repo: string, slug = "p3", liveness: LivenessReader = ProcessFacts): InFlight =>
  new InFlight(new WorkspaceRoot(repo, ".kairos/cdd"), slug, liveness);

/** A dead pid — far outside every platform's pid range (the table never carries it). */
const DEAD_PID = 4_000_001;

/** Whether the process runs without a permission check (root) — a read-only
 *  directory does not refuse a root writer, so the fail-open write pin cannot hold. */
const isRoot = (): boolean => typeof process.getuid === "function" && process.getuid() === 0;

/** An intent record over the given identity facts. */
const recordOf = (over: Partial<InFlightRecord> = {}): InFlightRecord => ({
  pid: process.pid,
  pgid: process.pid,
  command: "cdd implement --tasks 1 --plan docs/p3.md",
  slug: "p3",
  startedAt: Date.now(),
  wave: "1",
  phase: "implement",
  briefHash: null,
  plan: "docs/p3.md",
  sampledAt: null,
  verdict: null,
  ...over,
});

/** Plant a record file directly (the crash shape: a record without a lock). */
const plantRecord = (inflight: InFlight, record: InFlightRecord): void => {
  inflight.ensureMarker();
  writeFileSync(inflight.path(), `${JSON.stringify(record, null, 2)}\n`, "utf8");
};

/** Initialize a git repo (the tree-clean judgment's environment). */
const initRepo = (repo: string): void => {
  execFileSync("git", ["init", "-q"], { cwd: repo });
};

/** `git status --porcelain`'s answer for a repo. */
const porcelain = (repo: string): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" });

afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("InFlight.acquire — the intent record before the spawn", () => {
  it("writes the record under a fresh namespace and leaves the tree clean", async () => {
    const repo = scratch();
    initRepo(repo);
    const inflight = inflightOf(repo);
    const record = recordOf();
    await inflight.acquire(record);
    try {
      expect(existsSync(inflight.path())).toBe(true);
      expect(JSON.parse(readFileSync(inflight.path(), "utf8"))).toEqual(record);
      // The namespace keep-out marker was published by acquire itself (a fresh
      // namespace has no `.kairos/` at all before it) — the record never dirties git.
      expect(existsSync(path.join(repo, ".kairos", ".gitignore"))).toBe(true);
      expect(porcelain(repo)).toBe("");
    } finally {
      await inflight.release();
    }
  });

  it("refuses a second acquire with the holder's facts — and writes ZERO bytes to the record", async () => {
    const repo = scratch();
    const holder = inflightOf(repo);
    const record = recordOf({
      command: "cdd implement --tasks 3,4 --plan docs/p3.md",
      wave: "3,4",
    });
    await holder.acquire(record);
    try {
      const before = readFileSync(holder.path());
      const challenger = inflightOf(repo);
      let thrown: unknown = null;
      try {
        await challenger.acquire(
          recordOf({ command: "cdd review --type wave --tasks 1", wave: "1" }),
        );
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(HoldingError);
      const holding = thrown as HoldingError;
      expect(holding.record?.pid).toBe(record.pid);
      expect(holding.record?.command).toBe(record.command);
      expect(holding.record?.startedAt).toBe(record.startedAt);
      expect(holding.record?.wave).toBe("3,4");
      expect(holding.record?.slug).toBe("p3");
      // The failed challenger did not overwrite one byte of the standing record.
      expect(readFileSync(holder.path()).equals(before)).toBe(true);
    } finally {
      await holder.release();
    }
  });

  it("excludes a second slug too — the lock is tree-level, not workspace-level", async () => {
    const repo = scratch();
    const holder = inflightOf(repo, "alpha");
    await holder.acquire(recordOf({ slug: "alpha" }));
    try {
      const challenger = inflightOf(repo, "beta");
      await expect(challenger.acquire(recordOf({ slug: "beta" }))).rejects.toBeInstanceOf(
        HoldingError,
      );
      // The record still names the FIRST holder.
      const state = (await challenger.inspect()) as Extract<InFlightState, { kind: "held" }>;
      expect(state.kind).toBe("held");
      expect(state.record.slug).toBe("alpha");
    } finally {
      await holder.release();
    }
  });
});

describe("InFlight.release / inspect — the normal end and the crash", () => {
  it("removes the record and the lock at release — the reverse order of acquire", async () => {
    const repo = scratch();
    const inflight = inflightOf(repo);
    await inflight.acquire(recordOf());
    expect(existsSync(inflight.path())).toBe(true);
    expect(existsSync(inflight.lockPath())).toBe(true);
    await inflight.release();
    expect(existsSync(inflight.path())).toBe(false);
    expect(existsSync(inflight.lockPath())).toBe(false);
    expect(await inflight.inspect()).toEqual({ kind: "absent" });
  });

  it("reports absent on a fresh tree — no record, no lock", async () => {
    expect(await inflightOf(scratch()).inspect()).toEqual({ kind: "absent" });
  });

  it("keeps a crash's record standing and judges the holder dead — the postmortem fact", async () => {
    const repo = scratch();
    const inflight = inflightOf(repo);
    // The crash shape: the record was written, the lock is gone (a graceful exit
    // dropped it), and the holder process no longer exists.
    plantRecord(inflight, recordOf({ pid: DEAD_PID, startedAt: Date.now() }));
    const state = await inflight.inspect();
    expect(state.kind).toBe("held");
    if (state.kind !== "held") return;
    expect(state.alive).toBe(false);
    expect(state.record.pid).toBe(DEAD_PID);
    expect(existsSync(inflight.path())).toBe(true);
  });
});

describe("InFlight.inspect / steal — the corrupt record and the takeover rules", () => {
  /** A half-written record: the process died mid-write (never a valid JSON body). */
  const plantCorrupt = (inflight: InFlight, locked: boolean): void => {
    inflight.ensureMarker();
    writeFileSync(inflight.path(), '{"pid": 12, "starl', "utf8");
    if (locked) mkdirSync(inflight.lockPath(), { recursive: true });
  };

  it("reads a corrupt record with its leftover lock — corrupt + locked", async () => {
    const repo = scratch();
    const inflight = inflightOf(repo);
    plantCorrupt(inflight, true);
    expect(await inflight.inspect()).toEqual({ kind: "corrupt", locked: true });
  });

  it("reads a corrupt record with no lock — corrupt + unlocked", async () => {
    const repo = scratch();
    const inflight = inflightOf(repo);
    plantCorrupt(inflight, false);
    expect(await inflight.inspect()).toEqual({ kind: "corrupt", locked: false });
  });

  it("steals a corrupt locked record (clearing the lock), and refuses a live readable holder", async () => {
    const repo = scratch();
    const corrupt = inflightOf(repo);
    plantCorrupt(corrupt, true);
    expect(await corrupt.steal("the record is corrupt")).toBeNull();
    expect(existsSync(corrupt.path())).toBe(false);
    expect(existsSync(corrupt.lockPath())).toBe(false);
    // A readable record whose pid is alive is never stolen, whatever the reason.
    const live = inflightOf(repo);
    await live.acquire(recordOf());
    try {
      await expect(live.steal("the record is corrupt")).rejects.toThrow(/alive/);
      expect(existsSync(live.path())).toBe(true);
    } finally {
      await live.release();
    }
  });
});

describe("InFlight — the liveness judgment (alive folds null to true, pid reuse reads dead)", () => {
  it("treats an unreadable start time as alive — an unread fact never authorizes a takeover", async () => {
    const repo = scratch();
    const unreadable: LivenessReader = { live: async () => null };
    const inflight = inflightOf(repo, "p3", unreadable);
    plantRecord(inflight, recordOf());
    const state = await inflight.inspect();
    expect(state.kind).toBe("held");
    if (state.kind !== "held") return;
    expect(state.alive).toBe(true);
    await expect(inflight.steal("the holder looks stale")).rejects.toThrow(/alive/);
  });

  it("reads a reused pid as dead — the recorded start time is 10 minutes off the live one", async () => {
    const repo = scratch();
    const inflight = inflightOf(repo);
    plantRecord(inflight, recordOf({ pid: process.pid, startedAt: Date.now() + 10 * 60_000 }));
    const state = await inflight.inspect();
    expect(state.kind).toBe("held");
    if (state.kind !== "held") return;
    expect(state.alive).toBe(false);
  });
});

describe("InFlight.heartbeat — the fail-open trail write", () => {
  it.skipIf(isRoot())(
    "swallows an unwritable record write — while acquire() still reports its failure",
    async () => {
      const repo = scratch();
      const inflight = inflightOf(repo);
      plantRecord(inflight, recordOf());
      const before = readFileSync(inflight.path());
      // The namespace refuses new entries: the atomic write's temporary sibling and
      // the lock directory both fail, the standing record stays readable.
      chmodSync(path.dirname(inflight.path()), 0o555);
      try {
        expect(() =>
          inflight.heartbeat({ sampledAt: Date.now(), verdict: "progress" }),
        ).not.toThrow();
        // A lost sample never touches the identity bytes either.
        expect(readFileSync(inflight.path()).equals(before)).toBe(true);
        // The record write stays LOUD at the one place the invariant depends on it.
        await expect(inflight.acquire(recordOf({ wave: "2" }))).rejects.toBeInstanceOf(
          HoldingError,
        );
      } finally {
        chmodSync(path.dirname(inflight.path()), 0o755);
      }
    },
  );
});

describe("InFlight.acquire({ stealStale }) — the one explicit takeover path", () => {
  it("takes over a dead holder's record before locking — the new dispatch's facts replace it", async () => {
    const repo = scratch();
    const inflight = inflightOf(repo);
    plantRecord(inflight, recordOf({ pid: DEAD_PID, command: "cdd implement --tasks 9" }));
    const fresh = recordOf({ command: "cdd implement --tasks 1", wave: "1" });
    await inflight.acquire(fresh, { stealStale: true });
    try {
      const state = (await inflight.inspect()) as Extract<InFlightState, { kind: "held" }>;
      expect(state.record.command).toBe(fresh.command);
      expect(state.record.wave).toBe("1");
      expect(state.record.pid).toBe(process.pid);
    } finally {
      await inflight.release();
    }
  });

  it("takes over a dead holder whose SIGKILL left the lock behind too", async () => {
    const repo = scratch();
    const inflight = inflightOf(repo);
    plantRecord(inflight, recordOf({ pid: DEAD_PID }));
    mkdirSync(inflight.lockPath(), { recursive: true });
    await inflight.acquire(recordOf({ command: "cdd implement --tasks 2", wave: "2" }), {
      stealStale: true,
    });
    try {
      const state = (await inflight.inspect()) as Extract<InFlightState, { kind: "held" }>;
      expect(state.record.wave).toBe("2");
    } finally {
      await inflight.release();
    }
  });

  it("never crosses a LIVE holder — stealStale still refuses the acquire", async () => {
    const repo = scratch();
    const holder = inflightOf(repo);
    await holder.acquire(recordOf());
    try {
      // The current process is alive and its `startedAt` matches — a live holder.
      await expect(
        inflightOf(repo).acquire(recordOf({ command: "cdd review --type wave --tasks 1" }), {
          stealStale: true,
        }),
      ).rejects.toBeInstanceOf(HoldingError);
    } finally {
      await holder.release();
    }
  });

  it("behaves exactly like today when the flag is absent — a dead record still refuses", async () => {
    const repo = scratch();
    const inflight = inflightOf(repo);
    plantRecord(inflight, recordOf({ pid: DEAD_PID }));
    // A dead holder is NOT taken over without the explicit flag (the "never steal
    // automatically" rule): the lock attempt fails only if a lock stands — none does —
    // so the acquire succeeds only when the flag is given. Without a lock the record is
    // simply overwritten, exactly as before; WITH a lock it is refused.
    mkdirSync(inflight.lockPath(), { recursive: true });
    await expect(inflight.acquire(recordOf({ wave: "2" }))).rejects.toBeInstanceOf(HoldingError);
  });
});
