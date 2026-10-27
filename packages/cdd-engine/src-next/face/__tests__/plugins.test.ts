// packages/cdd-engine/src-next/face/__tests__/plugins.test.ts
// The plugin-roster suite — the package-axis single table's structural + byte pins:
//   · structure — the row order IS the execution order (superpowers →
//     mattpocock-skills → kairos), every row's column set is exactly the host id
//     set, and each shape's step count is the same per row (claude 2, pi 1);
//   · bytes — all nine install argv tuples and all nine update argv tuples pin the
//     declared command literals row by row, so the data plane is pinned here and
//     never reverse-derived from a README gate;
//   · zero shell — every argv carries its host CLI as the binary (argv[0]) and no
//     `-c` / `sh` wrapper, because the tuples go straight to the step runner.

import { describe, expect, it } from "vitest";

import { HOST_IDS, HOSTS } from "../host.ts";
import { PLUGINS } from "../plugins.ts";

/** The declared install argv — one entry per (row, host) pair, in roster order. */
const INSTALL_ARGV = {
  superpowers: {
    claude: [
      ["claude", "plugin", "marketplace", "add", "obra/superpowers-marketplace"],
      ["claude", "plugin", "install", "superpowers@superpowers-marketplace"],
    ],
    pi: [["pi", "install", "git:github.com/obra/superpowers"]],
  },
  "mattpocock-skills": {
    claude: [
      ["claude", "plugin", "marketplace", "add", "mattpocock/skills"],
      ["claude", "plugin", "install", "mattpocock-skills@mattpocock"],
    ],
    pi: [["pi", "install", "git:github.com/mattpocock/skills"]],
  },
  kairos: {
    claude: [
      ["claude", "plugin", "marketplace", "add", "oscaner/skills"],
      ["claude", "plugin", "install", "kairos@oscaner-skills"],
    ],
    pi: [["pi", "install", "npm:@oscaner-skills/kairos"]],
  },
} as const;

/** The declared update argv — the same shape as the install pin. */
const UPDATE_ARGV = {
  superpowers: {
    claude: [
      ["claude", "plugin", "marketplace", "update", "superpowers-marketplace"],
      ["claude", "plugin", "update", "superpowers@superpowers-marketplace"],
    ],
    pi: [["pi", "update", "git:github.com/obra/superpowers"]],
  },
  "mattpocock-skills": {
    claude: [
      ["claude", "plugin", "marketplace", "update", "mattpocock"],
      ["claude", "plugin", "update", "mattpocock-skills@mattpocock"],
    ],
    pi: [["pi", "update", "git:github.com/mattpocock/skills"]],
  },
  kairos: {
    claude: [
      ["claude", "plugin", "marketplace", "update", "oscaner-skills"],
      ["claude", "plugin", "update", "kairos@oscaner-skills"],
    ],
    pi: [["pi", "update", "npm:@oscaner-skills/kairos"]],
  },
} as const;

describe("the plugin roster's structure — row order is execution order", () => {
  it("the rows are exactly superpowers → mattpocock-skills → kairos (upstream first, kairos last)", () => {
    expect(PLUGINS.map((row) => row.name)).toEqual(["superpowers", "mattpocock-skills", "kairos"]);
  });

  it("every row's column set is exactly the host id set — no extra column, no missing column", () => {
    for (const row of PLUGINS) {
      const columns = Object.keys(row).filter((key) => key !== "name");
      expect(columns, `row "${row.name}" declares one column per host id`).toEqual([...HOST_IDS]);
    }
  });

  it("the two shapes carry the same step count per row — claude 2 steps, pi 1 step", () => {
    for (const row of PLUGINS) {
      for (const id of HOST_IDS) {
        expect(
          row[id].install.length,
          `row "${row.name}" · ${id}: install and update declare the same step count`,
        ).toBe(row[id].update.length);
      }
      expect(row.claude.install).toHaveLength(2);
      expect(row.pi.install).toHaveLength(1);
    }
  });
});

describe("the plugin roster's bytes — the nine update tuples and the nine install tuples", () => {
  it("every update argv tuple equals the declared update command literal", () => {
    for (const row of PLUGINS) {
      const expected = UPDATE_ARGV[row.name];
      for (const id of HOST_IDS) {
        expect(row[id].update, `row "${row.name}" · ${id}: update argv`).toEqual(expected[id]);
      }
    }
  });

  it("every install argv tuple equals the declared install command literal", () => {
    for (const row of PLUGINS) {
      const expected = INSTALL_ARGV[row.name];
      for (const id of HOST_IDS) {
        expect(row[id].install, `row "${row.name}" · ${id}: install argv`).toEqual(expected[id]);
      }
    }
  });
});

describe("the command tuples are structural — zero shell wrapping", () => {
  it("all eighteen argv tuples start with their host CLI and carry no shell wrapper", () => {
    const tuples = PLUGINS.flatMap((row) =>
      HOST_IDS.flatMap((id) => [...row[id].install, ...row[id].update]),
    );
    expect(tuples).toHaveLength(18);
    for (const row of PLUGINS) {
      for (const id of HOST_IDS) {
        for (const argv of [...row[id].install, ...row[id].update]) {
          expect(argv[0], `row "${row.name}" · ${id}: argv[0] is the host binary`).toBe(
            HOSTS[id].cli,
          );
          expect(argv).not.toContain("-c");
          expect(argv).not.toContain("sh");
        }
      }
    }
  });
});
