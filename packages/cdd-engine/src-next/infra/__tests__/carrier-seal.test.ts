// packages/cdd-engine/src-next/infra/__tests__/carrier-seal.test.ts
// P31 T5 — the carrier write-protection bit (design spec §2.4): a carrier lands
// read-only, a dispatch opens exactly its own two names, and the next preflight
// collects what a process killed outside the engine left writable.
//
// The pins are the permission FACTS and the sweep's SCOPE:
//   · `seal` / `unseal` write the two modes, and a name that never landed is not an
//     error (a failed round has no draft to seal);
//   · the sweep seals only the two carrier shapes the engine mints — `progress.json`,
//     `base.json` and the `*-test-evidence.json` sibling keep their bytes AND their
//     mode, and a `.rulings.json` sidecar is never touched (the orchestrator writes
//     rulings after the seal);
//   · an already-sealed carrier is zero churn (not rewritten, not returned), so the
//     sweep's return value IS the recovery it performed — the next preflight's proof
//     that an externally `chmod 644`'d carrier was taken back.

import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CarrierSeal } from "../carrier-seal.ts";

/** The permission bits of one path (the group/other/sticky bits are noise here). */
const modeOf = (target: string): number => statSync(target).mode & 0o777;

const dirs: string[] = [];

/** A fresh temp directory holding the given `{ name: body }` files at `0o644`. */
const directoryOf = (files: Readonly<Record<string, string>>): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-carrier-seal-"));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files))
    writeFileSync(path.join(dir, name), body, "utf8");
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("CarrierSeal — one carrier's mode", () => {
  it("seals to 0o444 and unseals to 0o644", () => {
    const dir = directoryOf({ "phase-spec-review-1.c2.json": "{}\n" });
    const carrier = path.join(dir, "phase-spec-review-1.c2.json");
    expect(modeOf(carrier)).toBe(0o644);
    CarrierSeal.seal(carrier);
    expect(modeOf(carrier)).toBe(0o444);
    CarrierSeal.unseal(carrier);
    expect(modeOf(carrier)).toBe(0o644);
  });

  it("is idempotent in either direction", () => {
    const dir = directoryOf({ "tasks-1-implement.json": "{}\n" });
    const carrier = path.join(dir, "tasks-1-implement.json");
    CarrierSeal.seal(carrier);
    CarrierSeal.seal(carrier);
    expect(modeOf(carrier)).toBe(0o444);
    CarrierSeal.unseal(carrier);
    CarrierSeal.unseal(carrier);
    expect(modeOf(carrier)).toBe(0o644);
  });

  it("treats a name that never landed as the round's own absence — neither method throws", () => {
    const dir = directoryOf({});
    const absent = path.join(dir, "tasks-1-fix-1.c1.json");
    expect(() => CarrierSeal.seal(absent)).not.toThrow();
    expect(() => CarrierSeal.unseal(absent)).not.toThrow();
    expect(() => statSync(absent)).toThrow();
  });
});

describe("CarrierSeal.sweep — the orphan recovery of one workspace", () => {
  /** The fixture's neighbours: every non-carrier JSON the workspace also holds, plus a
   *  sidecar and a report — none of them is a carrier shape. */
  const NEIGHBOURS: Readonly<Record<string, string>> = {
    "progress.json": '{"waves":[]}\n',
    "base.json": '{"base":"main"}\n',
    "tasks-1-test-evidence.json": '{"passed":true}\n',
    "tasks-1-review-2.c2.rulings.json": '{"rulings":[]}\n',
    "tasks-1-review-2-report.md": "report\n",
    "tasks-1-review-2.log": "log\n",
    "crash-tasks-1-review-2.json": '{"cause":"child-exit"}\n',
    "tasks-1-review.json": "{}\n",
    "tasks-1-fix.json": "{}\n",
  };

  it("seals a writable draft and a writable final — the recovery's own names", () => {
    const dir = directoryOf({
      "tasks-1-review-2.json": '{"findings":[]}\n',
      "tasks-1-review-2.c2.json": '{"findings":[]}\n',
    });
    const sealed = CarrierSeal.sweep(dir, []);
    expect([...sealed].sort()).toEqual(["tasks-1-review-2.c2.json", "tasks-1-review-2.json"]);
    expect(modeOf(path.join(dir, "tasks-1-review-2.json"))).toBe(0o444);
    expect(modeOf(path.join(dir, "tasks-1-review-2.c2.json"))).toBe(0o444);
  });

  it("recovers a carrier an external chmod reopened, and leaves an already-sealed one alone", () => {
    const dir = directoryOf({
      "overall-review-1.c1.json": '{"findings":[]}\n',
      "overall-review-2.c2.json": '{"findings":[]}\n',
    });
    const sealedAlready = path.join(dir, "overall-review-2.c2.json");
    CarrierSeal.seal(sealedAlready);
    const before = statSync(sealedAlready).mtimeMs;
    const sealed = CarrierSeal.sweep(dir, []);
    // Only the reopened carrier is returned; the sealed one is zero churn.
    expect([...sealed]).toEqual(["overall-review-1.c1.json"]);
    expect(modeOf(path.join(dir, "overall-review-1.c1.json"))).toBe(0o444);
    expect(modeOf(sealedAlready)).toBe(0o444);
    expect(statSync(sealedAlready).mtimeMs).toBe(before);
  });

  it("is a no-op on a second sweep — an empty return IS the nothing-to-do fact", () => {
    const dir = directoryOf({ "plan-fix-1.json": "{}\n" });
    expect([...CarrierSeal.sweep(dir, [])]).toEqual(["plan-fix-1.json"]);
    expect(CarrierSeal.sweep(dir, [])).toEqual([]);
  });

  it("never touches a non-carrier JSON, a sidecar, a report or a crash record — mode and bytes", () => {
    const dir = directoryOf(NEIGHBOURS);
    const sealed = CarrierSeal.sweep(dir, []);
    expect(sealed).toEqual([]);
    for (const [name, body] of Object.entries(NEIGHBOURS)) {
      const target = path.join(dir, name);
      expect(modeOf(target), name).toBe(0o644);
      expect(readFileSync(target, "utf8"), name).toBe(body);
    }
  });

  it("skips the caller's `keep` names — the paths a dispatch holds open itself", () => {
    const dir = directoryOf({
      "tasks-1-review-2.json": "{}\n",
      "tasks-1-review-2.c2.json": "{}\n",
    });
    const sealed = CarrierSeal.sweep(dir, ["tasks-1-review-2.json"]);
    expect([...sealed]).toEqual(["tasks-1-review-2.c2.json"]);
    expect(modeOf(path.join(dir, "tasks-1-review-2.json"))).toBe(0o644);
    expect(modeOf(path.join(dir, "tasks-1-review-2.c2.json"))).toBe(0o444);
  });

  it("treats an unreadable directory as no orphans at all", () => {
    expect(CarrierSeal.sweep(path.join(tmpdir(), "cdd-never-created-dir", "nope"), [])).toEqual([]);
  });

  it("recognizes both carrier shapes across the line families and nothing else", () => {
    const minted = [
      "tasks-1-implement.json",
      "tasks-7,9-review-2.json",
      "tasks-7,9-review-2.c2.json",
      "branch-review-3.c3.json",
      "phase-spec-fix-1.json",
      "phase-spec-fix-1.c1.json",
      "single-spec-review-1.c1.json",
      "tasks-1-fix-1-a2.json",
      "tasks-1-fix-1-a2.c1.json",
      "phase-spec-review-2-a3.json",
    ];
    const dir = directoryOf(Object.fromEntries(minted.map((name) => [name, "{}\n"])));
    // An external chmod is what makes a stale carrier an orphan (a sealed one is not).
    for (const name of minted) chmodSync(path.join(dir, name), 0o644);
    const sealed = CarrierSeal.sweep(dir, []);
    expect([...sealed].sort()).toEqual([...minted].sort());
  });
});
