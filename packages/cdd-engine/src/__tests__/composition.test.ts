// packages/cdd-engine/src/__tests__/composition.test.ts
// The composition root's ONE-instantiation pin.
//
// INVARIANT — the four slices are CONSTRUCTED once, in `src/bin.ts`, and `env/`'s own two
// capabilities are constructed once each inside `env/`. A second `new Env` / `new Documents` /
// `new Run` / `new Cli` anywhere else is a second composition: two graphs that can disagree
// about the same repository while every unit case on either of them stays green. The same
// argument holds one level down for `Provisioner` (the harness install sequence) and
// `BaseArtifact` (one workspace's base record) — a capability with two instantiation paths is
// a capability whose invariants are only half kept.
//
// The pin reads SOURCE, not behaviour, and it derives its name list from the classes
// themselves: the four slice names come from the imported entry classes, so renaming a slice
// moves the scan with it instead of leaving a stale literal behind.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Documents } from "../docs/index.ts";
import { Env } from "../env/index.ts";
import { Run } from "../run/index.ts";
import { Cli } from "../surface/index.ts";

/** The engine's `src` root. */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The composition root's own file — the ONE place the slices are constructed. */
const ROOT_FILE = path.join(SRC, "bin.ts");

/** Every non-test product file under `src/`, repo-relative to `src`. */
const productFiles = (directory: string = SRC): readonly string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      out.push(...productFiles(absolute));
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    out.push(absolute);
  }
  return out;
};

/** The product files whose text matches one pattern. */
const filesMatching = (pattern: RegExp): readonly string[] =>
  productFiles().filter((file) => pattern.test(readFileSync(file, "utf8")));

/** One file's path relative to `src`, for readable assertions. */
const relative = (file: string): string => path.relative(SRC, file).split(path.sep).join("/");

describe("the composition root is the one place the four slices are constructed", () => {
  it("constructs each slice entry exactly once, in `src/bin.ts`", () => {
    // The names are the classes', never a typed list: a rename moves the scan with it.
    const slices = [Env, Documents, Run, Cli].map((slice) => slice.name);
    expect(slices).toEqual(["Env", "Documents", "Run", "Cli"]);
    for (const name of slices) {
      const found = filesMatching(new RegExp(`\\bnew ${name}\\(`)).map(relative);
      expect(found, `${name} must be constructed only by the composition root`).toEqual(["bin.ts"]);
    }
  });

  it("constructs the provisioning sequence and the base artifact inside `env/` alone", () => {
    // Two capabilities, one instantiation path each: `Env`'s constructor builds the
    // provisioner, and `Workspace#baseOf` builds the artifact. The judgment is "inside the
    // env slice" — not a named file, because the slice may move a member without moving the
    // rule.
    for (const capability of ["Provisioner", "BaseArtifact"]) {
      const found = filesMatching(new RegExp(`\\bnew ${capability}\\(`)).map(relative);
      expect(found.length, `${capability} is constructed somewhere`).toBeGreaterThan(0);
      for (const file of found) {
        expect(file.startsWith("env/"), `${capability} constructed outside env/: ${file}`).toBe(
          true,
        );
        expect(file).not.toBe("bin.ts");
      }
    }
  });

  it("reads a real file set, so the scan is not passing over nothing", () => {
    // The pin's own control: the product tree exists and holds the four slice entrances.
    const files = productFiles().map(relative);
    for (const entrance of ["env/index.ts", "docs/index.ts", "run/index.ts", "surface/index.ts"]) {
      expect(files).toContain(entrance);
    }
    expect(existsSync(ROOT_FILE)).toBe(true);
  });
});
