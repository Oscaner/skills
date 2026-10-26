// packages/cdd-engine/src-next/face/plugins.ts
// The plugin roster — the package-axis single table of "what gets installed into a
// harness". One row per package, one column per harness id, two command shapes per
// column (install / update). Everything the install face runs, and everything the
// consumer README table renders, is this data: the README is a rendering surface
// plus a gate, never a second source.
//
// Row order is a first-class fact — the array order IS the execution order and the
// README row order (upstream dependencies first, kairos last). Object key order
// would not carry that promise, so the roster is an array of rows, not an object.
//
// The host vocabulary stays single-sourced in `face/host.ts`: this module declares
// no host id list — the row's column set closes over `HostId` (a missing column, or
// a new host without its column, is a type error), and the `claude` / `pi` tokens
// inside the argv tuples are the command literals themselves (the README table
// hands them to humans to copy verbatim), not a vocabulary copy.
//
// Module-level exports are types and declared constant data — zero behavior-carrying
// bare functions (the zero-bare-function discipline).

import type { HostId } from "./host.ts";

/** One install/update command — a structured argv, zero shell string. */
export type Command = readonly string[];

/** One package's two command shapes on one harness. */
export interface PluginCommands {
  /** The install sequence (marketplace add → plugin install; one step on pi). */
  readonly install: readonly Command[];
  /** The update sequence (marketplace update → plugin update; one step on pi). */
  readonly update: readonly Command[];
}

/** One roster row — the column set derives from `HostId`, so a missing host column
 *  is a type error today and a newly declared host without its column is a type
 *  error tomorrow. */
export type PluginRow = { readonly name: string } & Readonly<Record<HostId, PluginCommands>>;

/** The plugin roster — row order is execution order (upstream first, kairos last). */
export const PLUGINS = [
  {
    name: "superpowers",
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
] as const satisfies readonly PluginRow[];
