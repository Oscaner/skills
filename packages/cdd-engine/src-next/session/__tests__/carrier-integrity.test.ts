// packages/cdd-engine/src-next/session/__tests__/carrier-integrity.test.ts
// P31 T3 — the carrier content digest and its ONE checked read (design spec §2.2).
//
// The pins, in four groups:
//   · the digest rule — `sha256` over raw bytes, `digestOf` over the re-serialized
//     payload with the top-level `contentSha256` key dropped, `mismatch`'s four
//     states (either side unknown · equal · different);
//   · the checked read's three DISTINCT outcomes — absent (`null`), ok (bytes), and
//     mismatch (a thrown `CarrierMismatchError` whose message carries
//     `line` / `recorded` / `current`), plus the legacy record (no digest: zero
//     comparison, zero migration);
//   · the write seam — `Workspace.writeJsonHashed` returns the sha256 of exactly the
//     bytes `writeJson` lands (the draft shape: no `contentSha256`, so the payload
//     digest and the file digest are the same value);
//   · the ledger's record-shaped read — `persistHandoff` hands the digest back,
//     `recordRound` stores it beside `carrierPath`, and `readHandoff` compares through
//     the ONE rule.
// Fixtures are hermetic mkdtemp workspaces; no git, no child.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CarrierSeal } from "../../infra/carrier-seal.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { CarrierIntegrity, CarrierMismatchError } from "../carrier-integrity.ts";
import { Ledger } from "../ledger.ts";

interface Fixture {
  readonly ledger: Ledger;
  readonly workspace: Workspace;
  readonly cleanup: () => void;
}

const fixture = (): Fixture => {
  const repo = mkdtempSync(path.join(tmpdir(), "carrier-integrity-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "p31",
  ).ensure();
  const ledger = new Ledger(workspace, new ConfigLoader());
  return { ledger, workspace, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
};

/** One carrier file written verbatim (the tamper face: bytes the engine never wrote). */
const writeCarrier = (workspace: Workspace, name: string, body: unknown): string => {
  const at = workspace.resolve(name);
  writeFileSync(at, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return at;
};

describe("CarrierIntegrity — the digest rule (design spec §2.2)", () => {
  it("sha256 is the raw-byte hex — the published test vector", () => {
    expect(CarrierIntegrity.sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    // The empty string is a digest too — never an accidental null.
    expect(CarrierIntegrity.sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("digestOf is the re-serialized payload — a draft's digest equals its file bytes' digest", () => {
    const payload = { findings: [{ severity: "warn", summary: "drift" }] };
    const bytes = `${JSON.stringify(payload, null, 2)}\n`;
    expect(CarrierIntegrity.digestOf(payload)).toBe(CarrierIntegrity.sha256(bytes));
  });

  it("digestOf drops the top-level `contentSha256` key — a final carrier's digest covers its payload", () => {
    const payload = { findings: [], artifacts: {} };
    const withDigest = { ...payload, contentSha256: "whatever-the-writer-computed" };
    expect(CarrierIntegrity.digestOf(withDigest)).toBe(CarrierIntegrity.digestOf(payload));
    // Key ORDER of the surviving cells is preserved (the writer's own serialization).
    expect(CarrierIntegrity.digestOf(withDigest)).toBe(
      CarrierIntegrity.sha256(`${JSON.stringify(payload, null, 2)}\n`),
    );
  });

  it("mismatch answers null when either side is unknown, and the pair when the two differ", () => {
    expect(CarrierIntegrity.mismatch(null, "b")).toBeNull();
    expect(CarrierIntegrity.mismatch("a", null)).toBeNull();
    expect(CarrierIntegrity.mismatch(null, null)).toBeNull();
    expect(CarrierIntegrity.mismatch("a", "a")).toBeNull();
    expect(CarrierIntegrity.mismatch("a", "b")).toEqual({ recorded: "a", current: "b" });
  });
});

describe("CarrierIntegrity.read — absent / ok / mismatch are three distinct outcomes", () => {
  it("returns the bytes verbatim when the recorded digest matches", () => {
    const { workspace, cleanup } = fixture();
    try {
      const body = { findings: [{ severity: "nit", summary: "wording" }] };
      const at = writeCarrier(workspace, "tasks-1-review-1.json", body);
      const digest = CarrierIntegrity.digestOf(body);
      expect(CarrierIntegrity.read(at, digest)).toBe(readFileSync(at, "utf8"));
    } finally {
      cleanup();
    }
  });

  it("returns null for an absent carrier — an absence is never a mismatch", () => {
    const { workspace, cleanup } = fixture();
    try {
      const at = workspace.resolve("tasks-9-review-1.json");
      expect(CarrierIntegrity.read(at, "aaaa")).toBeNull();
      expect(CarrierIntegrity.read(at, null)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("throws `carrier-mismatch` with line / recorded / current when the bytes moved", () => {
    const { workspace, cleanup } = fixture();
    try {
      const recorded = CarrierIntegrity.digestOf({ findings: [] });
      const at = writeCarrier(workspace, "tasks-1-review-1.json", {
        findings: [{ severity: "blocker", summary: "smuggled" }],
      });
      let thrown: unknown;
      try {
        CarrierIntegrity.read(at, recorded);
      } catch (raw) {
        thrown = raw;
      }
      expect(thrown).toBeInstanceOf(CarrierMismatchError);
      const error = thrown as CarrierMismatchError;
      expect(error.line).toBe(at);
      expect(error.recorded).toBe(recorded);
      expect(error.current).toBe(
        CarrierIntegrity.digestOf({ findings: [{ severity: "blocker", summary: "smuggled" }] }),
      );
      // The message IS the diagnostic line — three named segments, sha8 prefixes.
      expect(error.message).toContain("carrier-mismatch · line=");
      expect(error.message).toContain(`line=${at}`);
      expect(error.message).toContain(`recorded=${recorded.slice(0, 8)}`);
      expect(error.message).toContain(`current=${error.current.slice(0, 8)}`);
    } finally {
      cleanup();
    }
  });

  it("a legacy record (no digest) reads the bytes even after they changed — present facts, zero migration", () => {
    const { workspace, cleanup } = fixture();
    try {
      const at = writeCarrier(workspace, "tasks-1-review-1.json", { findings: [] });
      // Rewritten by hand — with no recorded digest there is nothing to compare against.
      writeFileSync(at, '{\n  "findings": [\n    {\n      "severity": "nit"\n    }\n  ]\n}\n');
      expect(() => CarrierIntegrity.read(at, null)).not.toThrow();
      expect(JSON.parse(CarrierIntegrity.read(at, null) ?? "null")).toEqual({
        findings: [{ severity: "nit" }],
      });
    } finally {
      cleanup();
    }
  });

  it("readFor is the record-shaped shell — a null carrier path reads null without touching the disk", () => {
    const { workspace, cleanup } = fixture();
    try {
      expect(CarrierIntegrity.readFor({ carrierPath: null })).toBeNull();
      const body = { findings: [] };
      const at = writeCarrier(workspace, "tasks-1-review-1.json", body);
      expect(CarrierIntegrity.readFor({ carrierPath: at })).toBe(readFileSync(at, "utf8"));
      expect(
        CarrierIntegrity.readFor({
          carrierPath: at,
          carrierDigest: CarrierIntegrity.digestOf(body),
        }),
      ).toBe(readFileSync(at, "utf8"));
      expect(() =>
        CarrierIntegrity.readFor({ carrierPath: at, carrierDigest: CarrierIntegrity.digestOf({}) }),
      ).toThrow(CarrierMismatchError);
    } finally {
      cleanup();
    }
  });
});

describe("Workspace.writeJsonHashed — the write seam's returned digest", () => {
  it("returns the sha256 of exactly the bytes written (writeJson lands the same bytes)", () => {
    const { workspace, cleanup } = fixture();
    try {
      const value = { findings: [], artifacts: { brief: "/tmp/brief.md" } };
      const digest = workspace.writeJsonHashed("tasks-1-review-1.json", value);
      const at = workspace.resolve("tasks-1-review-1.json");
      const bytes = readFileSync(at, "utf8");
      expect(digest).toBe(CarrierIntegrity.sha256(bytes));
      // The plain write is the same seam — identical bytes, no second serialization.
      workspace.writeJson("twin.json", value);
      expect(readFileSync(workspace.resolve("twin.json"), "utf8")).toBe(bytes);
      // And the payload rule agrees for a digest-key-free draft (the ledger's case).
      expect(digest).toBe(CarrierIntegrity.digestOf(value));
    } finally {
      cleanup();
    }
  });
});

describe("Ledger — the digest is recorded beside carrierPath and read back through the ONE rule", () => {
  it("persistHandoff returns `{ path, draftPath, digest }` and recordRound stores both", () => {
    const { ledger, cleanup } = fixture();
    try {
      const persisted = ledger.persistHandoff(
        "review",
        "phase-spec",
        { round: 1 },
        { findings: [] },
      );
      // P31 §2.3 — the FINAL carrier is the round's read identity; the family name is
      // the child's draft beside it.
      expect(persisted.path).toBe(
        ledger.naming().finalPath(ledger.handoffName("review", "phase-spec", { round: 1 }), 1),
      );
      expect(persisted.draftPath).toBe(ledger.handoffPath("review", "phase-spec", { round: 1 }));
      // The digest covers the payload, never the file bytes that hold it.
      expect(persisted.digest).toBe(CarrierIntegrity.digestOf({ findings: [] }));
      ledger.recordRound("phase-spec", {
        op: "review",
        cycle: 1,
        carrierPath: persisted.path,
        carrierDigest: persisted.digest,
        draftPath: persisted.draftPath,
      });
      const [record] = ledger.recordsOf("phase-spec", "phase-spec");
      expect(record?.carrierPath).toBe(persisted.path);
      expect(record?.carrierDigest).toBe(persisted.digest);
      expect(record?.draftPath).toBe(persisted.draftPath);
    } finally {
      cleanup();
    }
  });

  it("readHandoff returns the parsed carrier while the bytes still digest to the record", () => {
    const { ledger, cleanup } = fixture();
    try {
      const { path: at, digest } = ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: 1 },
        { findings: [{ severity: "warn" }] },
      );
      ledger.recordRound("1", { op: "review", cycle: 1, carrierPath: at, carrierDigest: digest });
      // The parsed carrier holds the engine's own `contentSha256` key too — the read
      // returns the FINAL file, whose payload carries the embedded digest (P31 §2.3).
      const carrier = ledger.readHandoff("review", "wave", { tasks: "1", round: 1 });
      expect(carrier?.findings).toEqual([{ severity: "warn" }]);
      expect(carrier?.contentSha256).toBe(digest);
    } finally {
      cleanup();
    }
  });

  it("readHandoff refuses a tampered carrier — the message names recorded and current", () => {
    const { ledger, cleanup } = fixture();
    try {
      const { path: at, digest } = ledger.persistHandoff(
        "review",
        "wave",
        { tasks: "1", round: 1 },
        { findings: [] },
      );
      ledger.recordRound("1", { op: "review", cycle: 1, carrierPath: at, carrierDigest: digest });
      // The tamper is an EXTERNAL writer: a sealed carrier is read-only, so the bytes
      // move only after the permission bit is reopened (P31 §2.4).
      CarrierSeal.unseal(at);
      writeFileSync(at, `${JSON.stringify({ findings: [{ severity: "blocker" }] }, null, 2)}\n`);
      let thrown: unknown;
      try {
        ledger.readHandoff("review", "wave", { tasks: "1", round: 1 });
      } catch (raw) {
        thrown = raw;
      }
      expect(thrown).toBeInstanceOf(CarrierMismatchError);
      const message = (thrown as CarrierMismatchError).message;
      expect(message).toContain("recorded=");
      expect(message).toContain("current=");
      expect(message).toContain("line=");
    } finally {
      cleanup();
    }
  });

  it("readHandoff reads absent as null (never a mismatch) and a legacy record as present facts", () => {
    const { ledger, workspace, cleanup } = fixture();
    try {
      // A record carrying a digest with no file on disk: the absence wins, no throw.
      ledger.recordRound("1", {
        op: "review",
        cycle: 1,
        carrierPath: ledger.handoffPath("review", "wave", { tasks: "1", round: 1 }),
        carrierDigest: "0000",
      });
      expect(ledger.readHandoff("review", "wave", { tasks: "1", round: 1 })).toBeNull();

      // A LEGACY record (no digest column) over hand-written bytes: zero comparison.
      const at = writeCarrier(workspace, "tasks-1-review-1.json", { findings: [] });
      ledger.recordRound("1", { op: "review", cycle: 1, carrierPath: at });
      expect(ledger.readHandoff("review", "wave", { tasks: "1", round: 1 })).toEqual({
        findings: [],
      });
    } finally {
      cleanup();
    }
  });
});
