// packages/cdd-engine/src-next/infra/carrier-seal.ts
// P31 T5 — the write-protection bit of the engine's own carriers (design spec §2.4):
// a carrier lands READ-ONLY, the dispatch that owns it opens exactly its own two names
// (the child's draft, the engine's final), and every terminal seals again. The
// orchestrator's rulings ride a sidecar (`CarrierRulings`) that is never sealed, so a
// sealed carrier never blocks a ruling.
//
// The sweep is the recovery leg of the invariant: a carrier left writable by a process
// killed outside the engine is sealed by the NEXT dispatch's preflight. Its scope is
// the carrier NAME shapes `RoundNaming.isCarrierName` mints — never the directory's
// other JSON (`progress.json` · `base.json` · `*-test-evidence.json` · the crash
// records) and never a `.rulings.json` sidecar.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import { chmodSync, type Dirent, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { RoundNaming } from "../session/round-naming.ts";

/** The ruling sidecar's suffix — a sidecar is written AFTER its carrier is sealed and
 *  is never sealed itself (spec §2.1). The name rule lives with `CarrierRulings`; this
 *  is the sweep's own belt-and-braces skip, so a future widening of the carrier
 *  predicate can never sweep a sidecar. */
const RULINGS_SUFFIX = ".rulings.json";

/**
 * CarrierSeal — the permission-bit face of the engine's carriers. Stateless by
 * construction (every method is a judgment over a path), so the whole surface is
 * static: no instance could hold a different fact.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: every method is a judgment over a path argument; there is no per-instance state to hold.
export class CarrierSeal {
  /** The mode a carrier lands in: owner-read/write, everyone else read-only. */
  static readonly SEALED = 0o444;

  /** The mode a dispatch opens its OWN names with (the child writes the draft, the
   *  materialization rewrites the final). */
  static readonly WRITABLE = 0o644;

  /** Seal one carrier — idempotent, and a name that was never written (a failed round
   *  whose draft/final never landed) is not an error: the absence is the round's own
   *  fact, never a seal failure. */
  static seal(target: string): void {
    CarrierSeal.#chmod(target, CarrierSeal.SEALED);
  }

  /** Open one carrier for writing — the preflight half of a dispatch's own paths. */
  static unseal(target: string): void {
    CarrierSeal.#chmod(target, CarrierSeal.WRITABLE);
  }

  /** Seal every ORPHAN carrier of one directory and return the names actually sealed.
   *  An orphan is an engine carrier (the two name shapes `RoundNaming.isCarrierName`
   *  mints) that is still writable — left behind by a process killed outside the
   *  engine. `keep` names files the caller holds open itself (this round's own paths);
   *  a `.rulings.json` sidecar is never touched. Everything else in the directory is
   *  invisible to the sweep, and an already-sealed carrier is zero churn: not returned,
   *  not rewritten, so an empty array means there was nothing to recover. */
  static sweep(directory: string, keep: readonly string[]): readonly string[] {
    const strays = CarrierSeal.#strays(directory, keep);
    for (const name of strays) CarrierSeal.seal(path.join(directory, name));
    return strays;
  }

  /** The directory's orphan carrier NAMES — the sweep's judgment, before any chmod. */
  static #strays(directory: string, keep: readonly string[]): readonly string[] {
    const strays: string[] = [];
    for (const entry of CarrierSeal.#entries(directory)) {
      if (!entry.isFile()) continue;
      const target = path.join(directory, entry.name);
      if (!CarrierSeal.#isStray(target, entry.name, keep)) continue;
      strays.push(entry.name);
    }
    return strays;
  }

  /** Whether one directory entry is an orphan carrier the sweep must recover: a minted
   *  carrier name, not held open by the caller, not a ruling sidecar, and NOT already
   *  sealed. An unreadable entry (a vanished race) is not a stray — the sweep never
   *  invents a recovery it did not make. */
  static #isStray(target: string, name: string, keep: readonly string[]): boolean {
    if (!RoundNaming.isCarrierName(name)) return false;
    if (keep.includes(name) || name.endsWith(RULINGS_SUFFIX)) return false;
    try {
      return (statSync(target).mode & 0o777) !== CarrierSeal.SEALED;
    } catch {
      return false;
    }
  }

  /** The directory's entries — an unreadable directory (never created) holds no
   *  orphans, so the sweep is a no-op rather than a failure. */
  static #entries(directory: string): readonly Dirent[] {
    try {
      return readdirSync(directory, { withFileTypes: true });
    } catch {
      return [];
    }
  }

  /** The one chmod seam — a missing target is the round's own absence, not an error;
   *  every other failure (a permissions problem the engine cannot fix) is surfaced. */
  static #chmod(target: string, mode: number): void {
    try {
      chmodSync(target, mode);
    } catch (raw) {
      if ((raw as NodeJS.ErrnoException).code === "ENOENT") return;
      throw raw;
    }
  }
}
