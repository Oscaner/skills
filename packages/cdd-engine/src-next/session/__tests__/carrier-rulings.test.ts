// packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts
// P31 T2 — the rulings sidecar (design spec §2.1/§2.6). The path rule is the one
// orchestrator-facing convention (`<carrier>.json` → `<carrier>.rulings.json`), and
// the strict schema is the dispatch gate: every bad shape gets its OWN case here,
// because each one has to stop the fix round BEFORE the child is spawned — a ruling
// that was written but refused must never read as one the round silently ignored.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { CarrierRulings } from "../carrier-rulings.ts";

/** The carrier the sidecar sits beside — its basename is the `carrier` key's value. */
const CARRIER = "phase-spec-review-1.c2.json";

/** The carrier's own finding-id set — the injected fact a ruling must name. */
const FINDING_IDS: ReadonlySet<string> = new Set(["F1", "F4"]);

/** A legal sidecar body, over which each bad shape is written. */
const LEGAL = {
  carrier: CARRIER,
  rulings: [
    { finding: "F4", ruling: "REJECTED as stated", at: "2026-11-09T00:00:00Z", by: "orchestrator" },
  ],
};

/** One hermetic carrier directory per case. */
const dirs: string[] = [];

/** Create a carrier directory and return the carrier's absolute path (the file itself
 *  is never written: only the sidecar matters to this judgment). */
const carrierDir = (): { carrier: string; sidecar: string; cleanup: () => void } => {
  const dir = mkdtempSync(path.join(tmpdir(), "carrier-rulings-"));
  dirs.push(dir);
  const carrier = path.join(dir, CARRIER);
  return { carrier, sidecar: CarrierRulings.pathFor(carrier), cleanup: () => {} };
};

/** Judge one sidecar body (a string is written verbatim, anything else as JSON). */
const verdictOf = (body: unknown): ReturnType<typeof CarrierRulings.verdict> => {
  const { carrier, sidecar } = carrierDir();
  writeFileSync(sidecar, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return CarrierRulings.verdict(carrier, FINDING_IDS);
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("CarrierRulings.pathFor — the one `.json` → `.rulings.json` rule", () => {
  it("maps the draft name and the cycle name onto their sidecars", () => {
    expect(CarrierRulings.pathFor("/ws/phase-spec-review-1.json")).toBe(
      "/ws/phase-spec-review-1.rulings.json",
    );
    expect(CarrierRulings.pathFor("/ws/phase-spec-review-1.c2.json")).toBe(
      "/ws/phase-spec-review-1.c2.rulings.json",
    );
  });

  it("appends the suffix to a path that does not end in `.json`", () => {
    expect(CarrierRulings.pathFor("/ws/carrier")).toBe("/ws/carrier.rulings.json");
  });
});

describe("CarrierRulings — the three-state read", () => {
  it("reads absent when no sidecar exists", () => {
    const { carrier } = carrierDir();
    expect(CarrierRulings.verdict(carrier, FINDING_IDS)).toEqual({ kind: "absent" });
    expect(CarrierRulings.read(carrier)).toBeNull();
  });

  it("reads ok on a schema-conforming sidecar, and hands the rulings back", () => {
    const verdict = verdictOf(LEGAL);
    expect(verdict.kind).toBe("ok");
    expect(verdict.kind === "ok" ? verdict.rulings : []).toEqual([
      {
        finding: "F4",
        ruling: "REJECTED as stated",
        at: "2026-11-09T00:00:00Z",
        by: "orchestrator",
      },
    ]);
  });

  it("accepts a sidecar without the optional `carrier` key and without `at` / `by`", () => {
    const verdict = verdictOf({ rulings: [{ finding: "F1", ruling: "accepted" }] });
    expect(verdict).toEqual({ kind: "ok", rulings: [{ finding: "F1", ruling: "accepted" }] });
  });
});

describe("CarrierRulings — the nine refused shapes", () => {
  it("refuses a file that is not JSON", () => {
    const verdict = verdictOf("not json at all");
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("not JSON");
  });

  it("refuses a sidecar with no `rulings` key", () => {
    const verdict = verdictOf({ carrier: CARRIER });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("`rulings`");
  });

  it("refuses a `rulings` value that is not an array", () => {
    const verdict = verdictOf({ carrier: CARRIER, rulings: { F4: "no" } });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("not an array");
  });

  it("refuses a ruling with no `finding`", () => {
    const verdict = verdictOf({ rulings: [{ ruling: "accepted" }] });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("`finding`");
  });

  it("refuses a ruling with no `ruling`", () => {
    const verdict = verdictOf({ rulings: [{ finding: "F1" }] });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("`ruling`");
  });

  it("refuses an unknown top-level key", () => {
    const verdict = verdictOf({ ...LEGAL, extra: true });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("unknown top-level key");
  });

  it("refuses an unknown key inside a ruling", () => {
    const verdict = verdictOf({ rulings: [{ finding: "F1", ruling: "accepted", extra: 1 }] });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("unknown key");
  });

  it("refuses a ruling on a finding the carrier does not carry", () => {
    const verdict = verdictOf({ rulings: [{ finding: "F9", ruling: "accepted" }] });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain(
      "not a finding of the carrier",
    );
  });

  it("refuses a `carrier` key that does not name this carrier", () => {
    const verdict = verdictOf({ ...LEGAL, carrier: "phase-spec-review-2.c2.json" });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("≠ the carrier");
  });

  it("names the refused sidecar path in every reason", () => {
    const { carrier, sidecar } = carrierDir();
    mkdirSync(path.dirname(sidecar), { recursive: true });
    writeFileSync(sidecar, "{", "utf8");
    const verdict = CarrierRulings.verdict(carrier, FINDING_IDS);
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain(sidecar);
  });
});
