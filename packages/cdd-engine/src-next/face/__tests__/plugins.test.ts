// packages/cdd-engine/src-next/face/__tests__/plugins.test.ts
// The plugin-roster suite — the package-axis single table's structural + byte pins:
//   · structure — the row order IS the execution order (the core three first:
//     superpowers → mattpocock-skills → kairos, then the six recommended rows), each
//     row carries its tier, every row's column set is exactly the host id set (the
//     tier is a row fact, not a column), and the two shapes carry the same step count
//     per row (core: claude 2 / pi 1; recommended: claude 0 / pi 1);
//   · bytes — all fifteen install argv tuples and all fifteen update argv tuples pin
//     the declared command literals row by row, so the data plane is pinned here and
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
  "pi-fff": {
    claude: [],
    pi: [["pi", "install", "npm:@ff-labs/pi-fff"]],
  },
  "rpiv-todo": {
    claude: [],
    pi: [["pi", "install", "npm:@juicesharp/rpiv-todo"]],
  },
  "rpiv-ask-user-question": {
    claude: [],
    pi: [["pi", "install", "npm:@juicesharp/rpiv-ask-user-question"]],
  },
  "pi-web-access": {
    claude: [],
    pi: [["pi", "install", "npm:pi-web-access"]],
  },
  "pi-background-tasks": {
    claude: [],
    pi: [["pi", "install", "npm:pi-background-tasks"]],
  },
  "pi-agentsmd": {
    claude: [],
    pi: [["pi", "install", "npm:pi-agentsmd"]],
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
  "pi-fff": {
    claude: [],
    pi: [["pi", "update", "npm:@ff-labs/pi-fff"]],
  },
  "rpiv-todo": {
    claude: [],
    pi: [["pi", "update", "npm:@juicesharp/rpiv-todo"]],
  },
  "rpiv-ask-user-question": {
    claude: [],
    pi: [["pi", "update", "npm:@juicesharp/rpiv-ask-user-question"]],
  },
  "pi-web-access": {
    claude: [],
    pi: [["pi", "update", "npm:pi-web-access"]],
  },
  "pi-background-tasks": {
    claude: [],
    pi: [["pi", "update", "npm:pi-background-tasks"]],
  },
  "pi-agentsmd": {
    claude: [],
    pi: [["pi", "update", "npm:pi-agentsmd"]],
  },
} as const;

/** The one roster fact a row's step counts follow — the tier is data, not a
 *  test-side judgment: a core row installs two claude commands, a recommended row
 *  installs none (Claude Code carries those capabilities natively). */
const CLAUDE_STEPS_BY_TIER = { core: 2, recommended: 0 } as const;

describe("the plugin roster's structure — row order is execution order", () => {
  it("the rows are exactly core three then recommended six (superpowers → mattpocock-skills → kairos → pi-fff → …)", () => {
    expect(PLUGINS.map((row) => row.name)).toEqual([
      "superpowers",
      "mattpocock-skills",
      "kairos",
      "pi-fff",
      "rpiv-todo",
      "rpiv-ask-user-question",
      "pi-web-access",
      "pi-background-tasks",
      "pi-agentsmd",
    ]);
  });

  it("each row declares its tier — the core three first, the recommended six after", () => {
    expect(PLUGINS.map((row) => row.tier)).toEqual([
      "core",
      "core",
      "core",
      "recommended",
      "recommended",
      "recommended",
      "recommended",
      "recommended",
      "recommended",
    ]);
  });

  it("every row's column set is exactly the host id set — no extra column, no missing column", () => {
    for (const row of PLUGINS) {
      const columns = Object.keys(row).filter((key) => key !== "name" && key !== "tier");
      expect(columns, `row "${row.name}" declares one column per host id`).toEqual([...HOST_IDS]);
    }
  });

  it("the two shapes carry the same step count per row", () => {
    for (const row of PLUGINS) {
      for (const id of HOST_IDS) {
        expect(
          row[id].install.length,
          `row "${row.name}" · ${id}: install and update declare the same step count`,
        ).toBe(row[id].update.length);
      }
      expect(
        row.claude.install,
        `row "${row.name}": the claude column follows its tier`,
      ).toHaveLength(CLAUDE_STEPS_BY_TIER[row.tier]);
      expect(row.pi.install, `row "${row.name}": every row installs once on pi`).toHaveLength(1);
    }
  });

  it("a recommended row's claude column is two EMPTY arrays — an empty cell, never a missing column", () => {
    for (const row of PLUGINS.filter((entry) => entry.tier === "recommended")) {
      expect(row.claude, `row "${row.name}": the claude column exists and is empty`).toEqual({
        install: [],
        update: [],
      });
    }
  });
});

describe("the plugin roster's bytes — the fifteen update tuples and the fifteen install tuples", () => {
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
  it("all thirty argv tuples start with their host CLI and carry no shell wrapper", () => {
    const tuples = PLUGINS.flatMap((row) =>
      HOST_IDS.flatMap((id) => [...row[id].install, ...row[id].update]),
    );
    expect(tuples).toHaveLength(30);
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
