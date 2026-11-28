// packages/cdd-engine/src/env/provision/plugins.ts
// The plugin roster — the package-axis single table of "what gets installed into a
// harness". One row per package, one column per harness id, two command shapes per column
// (install / update). Everything the install face runs is this data: there is no second
// list of packages anywhere in the tree.
//
// Row order is a first-class fact — the array order IS the execution order. Object key
// order would not carry that promise, so the roster is an array of rows.
//
// `tier` splits the same table in two without a second list: `core` rows are the install
// contract `cdd init` always runs, `recommended` rows are the opt-in capability packages
// `--include-recommends` asks for. Claude Code carries those capabilities natively, so a
// recommended row's claude column is an EMPTY array — an empty cell, never a missing
// column and never a placeholder to be filled for symmetry.
//
// The host vocabulary stays single-sourced in `env/process/host.ts`: this module declares
// no host id list — the row's column set closes over `HostId`, so a new host without its
// column is a type error.
//
// Module-level exports are types and declared constant data — zero behaviour-carrying bare
// functions.

import type { HostId } from "../process/host.ts";

/** One install/update command — a structured argv, zero shell string. */
export type Command = readonly string[];

/** One package's two command shapes on one harness. */
export interface PluginCommands {
  /** The install sequence (marketplace add → plugin install). */
  readonly install: readonly Command[];
  /** The update sequence (marketplace update → plugin update). */
  readonly update: readonly Command[];
}

/** The roster's two tiers — the install contract vs. the opt-in capability set. */
export type PluginTier = "core" | "recommended";

/** One roster row — the column set derives from `HostId`, so a missing host column is a
 *  type error today and a newly declared host without its column is a type error
 *  tomorrow. */
export type PluginRow = {
  /** The package's name, as the summary and the failure line spell it. */
  readonly name: string;
  /** Which tier the row belongs to. */
  readonly tier: PluginTier;
} & Readonly<Record<HostId, PluginCommands>>;

/** The plugin roster — row order is execution order (upstream dependencies first, the
 *  engine's own plugin last, then the opt-in capability packages). */
export const PLUGINS = [
  {
    name: "superpowers",
    tier: "core",
    claude: {
      install: [
        ["claude", "plugin", "marketplace", "add", "obra/superpowers-marketplace"],
        ["claude", "plugin", "install", "superpowers@superpowers-marketplace"],
      ],
      update: [
        ["claude", "plugin", "marketplace", "update", "superpowers-marketplace"],
        ["claude", "plugin", "update", "superpowers@superpowers-marketplace"],
      ],
    },
    pi: {
      install: [["pi", "install", "git:github.com/obra/superpowers"]],
      update: [["pi", "update", "git:github.com/obra/superpowers"]],
    },
  },
  {
    name: "mattpocock-skills",
    tier: "core",
    claude: {
      install: [
        ["claude", "plugin", "marketplace", "add", "mattpocock/skills"],
        ["claude", "plugin", "install", "mattpocock-skills@mattpocock"],
      ],
      update: [
        ["claude", "plugin", "marketplace", "update", "mattpocock"],
        ["claude", "plugin", "update", "mattpocock-skills@mattpocock"],
      ],
    },
    pi: {
      install: [["pi", "install", "git:github.com/mattpocock/skills"]],
      update: [["pi", "update", "git:github.com/mattpocock/skills"]],
    },
  },
  {
    name: "kairos",
    tier: "core",
    claude: {
      install: [
        ["claude", "plugin", "marketplace", "add", "oscaner/skills"],
        ["claude", "plugin", "install", "kairos@oscaner-skills"],
      ],
      update: [
        ["claude", "plugin", "marketplace", "update", "oscaner-skills"],
        ["claude", "plugin", "update", "kairos@oscaner-skills"],
      ],
    },
    pi: {
      install: [["pi", "install", "npm:@oscaner-skills/kairos"]],
      update: [["pi", "update", "npm:@oscaner-skills/kairos"]],
    },
  },
  // The six recommended capability packages — pi-only rows. Claude Code carries file
  // search, todo tracking, structured questioning, web access, background tasks and
  // AGENTS.md injection natively, so the claude column stays EMPTY here.
  {
    name: "pi-fff",
    tier: "recommended",
    claude: { install: [], update: [] },
    pi: {
      install: [["pi", "install", "npm:@ff-labs/pi-fff"]],
      update: [["pi", "update", "npm:@ff-labs/pi-fff"]],
    },
  },
  {
    name: "rpiv-todo",
    tier: "recommended",
    claude: { install: [], update: [] },
    pi: {
      install: [["pi", "install", "npm:@juicesharp/rpiv-todo"]],
      update: [["pi", "update", "npm:@juicesharp/rpiv-todo"]],
    },
  },
  {
    name: "rpiv-ask-user-question",
    tier: "recommended",
    claude: { install: [], update: [] },
    pi: {
      install: [["pi", "install", "npm:@juicesharp/rpiv-ask-user-question"]],
      update: [["pi", "update", "npm:@juicesharp/rpiv-ask-user-question"]],
    },
  },
  {
    name: "pi-web-access",
    tier: "recommended",
    claude: { install: [], update: [] },
    pi: {
      install: [["pi", "install", "npm:pi-web-access"]],
      update: [["pi", "update", "npm:pi-web-access"]],
    },
  },
  {
    name: "pi-background-tasks",
    tier: "recommended",
    claude: { install: [], update: [] },
    pi: {
      install: [["pi", "install", "npm:pi-background-tasks"]],
      update: [["pi", "update", "npm:pi-background-tasks"]],
    },
  },
  {
    name: "pi-agentsmd",
    tier: "recommended",
    claude: { install: [], update: [] },
    pi: {
      install: [["pi", "install", "npm:pi-agentsmd"]],
      update: [["pi", "update", "npm:pi-agentsmd"]],
    },
  },
] as const satisfies readonly PluginRow[];
