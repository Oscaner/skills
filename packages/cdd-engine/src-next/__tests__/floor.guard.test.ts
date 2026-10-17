// packages/cdd-engine/src-next/__tests__/floor.guard.test.ts
// T8 (spec §3.1 ②) — the floor single-source gate. ② is TWO distinct facts that
// must NOT be merged into one source:
//   · the INSTALL floor — `packages/cdd-engine/package.json#engines` ("node"):
//     which Node the published artifact is installed/run on. The README install
//     lines (README.md + its zh mirror) must agree with it.
//   · the TYPE-STRIPPING floor — `bin.ts` `NODE_FLOOR` (22.18): the dev face's
//     `node src-next/bin.ts` native-type-stripping requirement. The README
//     development lines must agree with it.
// Deriving NODE_FLOOR from `#engines` (`>=24`) would make the guard OVER-STRICT
// (it would reject Node 22.18–23.x, which the README explicitly documents as
// usable for source-direct runs), so the two facts stay separate and each is
// pinned to its own correct source by this gate.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ENGINE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${ENGINE_ROOT}/${rel}`, "utf8");

/** The install floor declared by `package.json#engines.node` (e.g. ">=24"). */
const enginesFloor = (): string => {
  const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };
  const node = pkg.engines?.node;
  if (node === undefined) throw new Error("package.json#engines.node is missing");
  return node.replace(/\s+/g, "");
};

/** The type-stripping floor declared by `bin.ts`'s NODE_FLOOR (major.minor). */
const typeStrippingFloor = (): string => {
  const src = read("src-next/bin.ts");
  const match = /const NODE_FLOOR = \{ major: (\d+), minor: (\d+) \}/.exec(src);
  if (match === null) throw new Error("bin.ts NODE_FLOOR shape changed");
  return `${match[1]}.${match[2]}`;
};

describe("the two floors hold their correct single source (spec §3.1 ②)", () => {
  it("the INSTALL floor — both README install lines agree with package.json#engines", () => {
    const floor = enginesFloor(); // ">=24"
    const bare = floor.replace(/^>=\s*/, ""); // "24"
    for (const rel of ["README.md", "README.zh-CN.md"]) {
      const src = read(rel);
      // The install-requirement line: "Requires Node.js `>= 24`." / "需要 Node.js `>= 24`。"
      const match = /Node\.js `([^`]+)`/.exec(src);
      expect(match, `${rel}: no install-floor line`).not.toBeNull();
      expect(match?.[1]?.replace(/\s+/g, ""), `${rel}: install floor drifted from #engines`).toBe(
        [">=", bare].join(""),
      );
    }
  });

  it("the TYPE-STRIPPING floor — both README development lines agree with bin.ts NODE_FLOOR", () => {
    const floor = typeStrippingFloor(); // "22.18"
    for (const rel of ["README.md", "README.zh-CN.md"]) {
      const src = read(rel);
      // The dev line: "… (Node ≥22.18 native type stripping)" / "…（Node ≥22.18 原生类型剥离）"
      const match = /Node\s*≥\s*(\d+\.\d+)/.exec(src);
      expect(match, `${rel}: no type-stripping-floor line`).not.toBeNull();
      expect(match?.[1], `${rel}: dev floor drifted from NODE_FLOOR`).toBe(floor);
    }
  });

  it("the two facts stay distinct — the install floor is not silently merged into NODE_FLOOR", () => {
    // The install floor (>=24) and the type-stripping floor (22.18) are different
    // numbers: deriving the latter from the former would over-strict the dev guard.
    expect(enginesFloor().replace(/^>=\s*/, "")).not.toBe(typeStrippingFloor().split(".")[0]);
  });
});
