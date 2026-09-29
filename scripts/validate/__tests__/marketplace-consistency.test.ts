// scripts/validate/__tests__/marketplace-consistency.test.ts — Task 4 (pi-harness-p2
// C5): the emit harness registry consistency guard, probed from both directions.
// A same-root hardening test pins the live tree (three assertions all green), then
// deliberate-break probes construct a temporary packages/ fixture to demonstrate
// that each assertion actually fails on its defect: an unknown declared harness id
// (① / the declared-side of the bijection), a registered-but-unwired harness via a
// two-package subset declaration (② / the registry-side of the bijection), a
// declared emit-harness whose product is missing on disk (③), and a malformed
// non-array declaration. The live declarations cannot be temporarily stripped —
// the fixture exists exactly to exercise both bijection directions in-process.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { validateHarnessRegistryConsistency } from "../marketplace.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Seed one package.json under a temp fixture root. */
function seedPackage(packagesRoot, dirName, pkg) {
  mkdirSync(join(packagesRoot, dirName), { recursive: true });
  writeFileSync(join(packagesRoot, dirName, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

/** Run fn against a temp packages/ root seeded with the given declarations. */
function withFixture(pkgs, fn) {
  const root = mkdtempSync(join(tmpdir(), "harness-consistency-"));
  try {
    for (const [dirName, pkg] of Object.entries(pkgs)) seedPackage(root, dirName, pkg);
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("consistency guard passes the live tree (three assertions)", () => {
  expect(() => validateHarnessRegistryConsistency(join(REPO_ROOT, "packages"))).not.toThrow();
});

test("① deliberate-break: an unknown declared harness id fails with the id + expected set", () => {
  withFixture(
    {
      "probe-a": { name: "probe-a", oscaner: { harnesses: ["claude", "bogus"] } },
      "probe-b": { name: "probe-b", oscaner: { harnesses: ["cursor", "pi"] } },
    },
    (root) => {
      expect(() => validateHarnessRegistryConsistency(root)).toThrow(/bogus/);
      // expected set comes from the registry's fixed iteration order (cursor, claude, pi)
      expect(() => validateHarnessRegistryConsistency(root)).toThrow(
        /expected one of: cursor, claude, pi/,
      );
    },
  );
});

test("② deliberate-break: a registry row no package declares fails (registry-side)", () => {
  withFixture(
    {
      "probe-a": { name: "probe-a", oscaner: { harnesses: ["claude"] } },
      "probe-b": { name: "probe-b", oscaner: { harnesses: ["cursor"] } },
    },
    (root) => {
      // claude + cursor are declared, pi never is → the unwired registry row fails
      expect(() => validateHarnessRegistryConsistency(root)).toThrow(
        /registered but declared by no package/,
      );
      expect(() => validateHarnessRegistryConsistency(root)).toThrow(/pi/);
    },
  );
});

test("③ deliberate-break: a declared emit-harness product missing on disk fails", () => {
  withFixture(
    {
      "probe-a": {
        name: "probe-a",
        // all three declared so ② (wiring) passes and only ③ can fail
        oscaner: { contentRoot: ".", harnesses: ["claude", "cursor", "pi"] },
      },
    },
    (root) => {
      expect(() => validateHarnessRegistryConsistency(root)).toThrow(
        /declares emit-harness "claude" but its product is missing/,
      );
    },
  );
});

test("① deliberate-break: a non-array oscaner.harnesses fails cleanly", () => {
  withFixture({ "probe-a": { name: "probe-a", oscaner: { harnesses: "claude" } } }, (root) => {
    expect(() => validateHarnessRegistryConsistency(root)).toThrow(
      /must declare oscaner\.harnesses as an array/,
    );
  });
});
