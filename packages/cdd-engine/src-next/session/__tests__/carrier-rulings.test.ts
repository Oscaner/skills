// packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts
// P31 T2 — the rulings sidecar (design spec §2.1/§2.6). The strict schema is the
// dispatch gate: every bad shape gets its OWN case here, because each one has to stop
// the fix round BEFORE the child is spawned — a ruling that was written but refused
// must never read as one the round silently ignored.
//
// The sidecar's PATH is no longer minted here: it is the artifact matrix's `rulings`
// row rendered from the reviewed round's identity (P36 T2). This suite takes the
// rendered path from its caller, and pins that the class holds no naming rule of its own
// (the sidecar tail is spelled in the matrix row alone) and that the strict gate still
// judges the `carrier` key against the CARRIER's basename — the carrier's fact is never
// re-derived from the sidecar's name.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { stripComments } from "../../__tests__/support/strip-comments.ts";
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

/** The sidecar's NAME for this fixture's carrier — the matrix's `final` stem with the
 *  `.rulings` tail (`phase-spec-review-1.c2.rulings.json`). A fixture may spell the
 *  literal; the production face may not. */
const SIDECAR_NAME = CARRIER.replace(/\.json$/, ".rulings.json");

/** Create a carrier directory and return the carrier's absolute path (the file itself
 *  is never written: only the sidecar matters to this judgment). */
const carrierDir = (): { carrier: string; sidecar: string; cleanup: () => void } => {
  const dir = mkdtempSync(path.join(tmpdir(), "carrier-rulings-"));
  dirs.push(dir);
  const carrier = path.join(dir, CARRIER);
  return { carrier, sidecar: path.join(dir, SIDECAR_NAME), cleanup: () => {} };
};

/** Judge one sidecar body (a string is written verbatim, anything else as JSON). */
const verdictOf = (body: unknown): ReturnType<typeof CarrierRulings.verdict> => {
  const { carrier, sidecar } = carrierDir();
  writeFileSync(sidecar, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return CarrierRulings.verdict(sidecar, carrier, FINDING_IDS);
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("CarrierRulings — no naming rule of its own (P36 T2)", () => {
  /** `src-next/session` — the sidecar class's own plane. */
  const SESSION_ROOT = fileURLToPath(new URL("../../session/", import.meta.url));

  it("holds no sidecar-tail spelling — the matrix row renders the name", () => {
    const files = readdirSync(SESSION_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => entry.name);
    const hits = files.filter((name) =>
      stripComments(readFileSync(path.join(SESSION_ROOT, name), "utf8")).includes(".rulings.json"),
    );
    // The matrix row is the ONE home. `session/next.ts` still spells the readback rule
    // sentence; closing that set to the matrix row alone is the later task's tightening
    // (the readback line becomes a rendered VALUE), so this pin holds the class itself
    // out of the set without pre-empting it.
    expect(hits).not.toContain("carrier-rulings.ts");
    expect(hits).toContain("round-artifacts.ts");
  });

  it("takes the sidecar's rendered path from its caller, not from the carrier's tail", () => {
    // The two carriers of ONE round (draft, final) render ONE sidecar — that is the
    // matrix's fact, so the same rendered path judges both.
    const { carrier, sidecar } = carrierDir();
    writeFileSync(sidecar, JSON.stringify({ ...LEGAL, carrier: path.basename(carrier) }), "utf8");
    expect(CarrierRulings.verdict(sidecar, carrier, FINDING_IDS).kind).toBe("ok");
  });
});

describe("CarrierRulings — the three-state read", () => {
  it("reads absent when no sidecar exists", () => {
    const { carrier, sidecar } = carrierDir();
    expect(CarrierRulings.verdict(sidecar, carrier, FINDING_IDS)).toEqual({ kind: "absent" });
    expect(CarrierRulings.read(sidecar, carrier)).toBeNull();
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
    const verdict = CarrierRulings.verdict(sidecar, carrier, FINDING_IDS);
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain(sidecar);
  });
});
