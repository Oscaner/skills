// packages/cdd-engine/src/docs/judging/shape-rules.ts
// The path grammar the shape rules read: `PathShape` answers one question for every
// reader that has to decide whether a backticked or tabulated token NAMES A LOCATION —
// `pathOf` gives the `path.ext[:line[-line]]` form (or null), `isPattern` says whether a
// token is a placeholder family rather than a coordinate, and `normalize` is the ONE
// spelling of a path's written form (a leading `./` and trailing slashes are prose).
//
// It lives beside the rule table it serves (`judging/rules.ts`) because the two are one
// thing read twice: a rule that judges a claimed file reads its tokens through this
// grammar, and the closure reading normalizes the judged document through the same one, so
// two writings of one location never read as two locations.
//
// Module-level exports are the type plus the class — zero behaviour-carrying bare
// functions.

import type { RepoPath } from "../../env/paths/root.ts";

/** One path-shaped token: the path plus the optional line / range it names. */
export interface PathForm {
  readonly path: string;
  readonly firstLine?: number;
  readonly lastLine?: number;
}

/** The extensions a SEPARATOR-LESS token must carry to be a path — a dotted member name
 *  (`process.env` · `HOSTS.env`) is a symbol, not a file. A token carrying `/` is a path
 *  whatever its extension: the separator already says it names a location, so an asset
 *  coordinate (`docs/diagrams/src/architecture.png`) is judged rather than slipping into
 *  prose. */
const FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  "ts",
  "tsx",
  "js",
  "mjs",
  "cjs",
  "json",
  "md",
  "yml",
  "yaml",
  "sh",
  "toml",
  "txt",
  "css",
  "html",
]);

/**
 * PathShape — the path grammar. The three answers below are the whole surface: what a
 * token means as a location, what counts as a placeholder instead, and how a written path
 * is normalized before any comparison.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the path grammar is a declared static vocabulary set — the repo's zero-bare-function discipline admits no standalone predicates.
export class PathShape {
  /** The placeholder metacharacters — a token carrying one is a PATTERN, and a pattern
   *  names no coordinate: `*-overall.md` names a family, `<slug>-design.md` names a rule
   *  for deriving a path. Neither is a location a reader can follow. */
  static isPattern(token: string): boolean {
    return /[*<>{}|\s]/.test(token);
  }

  /** The path shape `path.ext[:line[-line]]`, or null when the token is not path-shaped.
   *  An extension is required — `BLOCKED/TIMEOUT`, `--spec/--plan` and
   *  `findings/artifacts/notes` are prose compounds, and `ReviewKey` is a symbol. The
   *  extension VOCABULARY, however, only gates a token with no separator: behind a `/`,
   *  "the asset I cite" is a judged claim whatever the asset's extension
   *  (`docs/diagrams/src/architecture.png`), while `process.env` carries no separator and
   *  needs its extension in the vocabulary to be a file at all. What still decides is the
   *  SHAPE, not the vocabulary: `#` marks a member half
   *  (`session/ledger.ts#Round.findingsPath`), a segment opening with `.` is a dotfile
   *  name (`.kairos/.gitignore`), and an extension must look like one (lowercase, letter
   *  first) — which leaves `@scope/pkg@1.3.0` and `REVIEWS.wave/branch.axesGuide` prose
   *  where they belong. */
  static pathOf(token: string): PathForm | null {
    if (PathShape.isPattern(token)) return null;
    const match = /^(?<file>[^\s:]+)(?::(?<first>\d+)(?:-(?<last>\d+))?)?$/.exec(token);
    const groups = match?.groups;
    if (groups === undefined) return null;
    const file = groups.file;
    // A leading-dot or leading-dash token with no separator names a SUFFIX
    // (`.rulings.json` · `.md` · `-overall.md`): it is a word about names, not a name. A
    // prefixed PATH (`.github/workflows/x.yml`, `docs/kairos/specs/<slug>-overall.md`)
    // still carries its separator and stays a coordinate.
    if ((file.startsWith(".") || file.startsWith("-")) && !file.includes("/")) return null;
    // `#` is a member separator, never a byte of a tree path: the member face judges
    // those, and reading one as a path would report a carrier/link as a missing file.
    if (file.includes("#")) return null;
    const extension = /\.([A-Za-z0-9]+)$/.exec(file)?.[1] ?? "";
    // An extension is a lowercase name (`ts` · `md` · `png`), not a version tail
    // (`@scope/pkg@1.3.0` → `0`) nor a dotted prose compound
    // (`REVIEWS.wave/branch.axesGuide`).
    if (!/^[a-z][a-z0-9]*$/.test(extension)) return null;
    if (!FILE_EXTENSIONS.has(extension) && !file.includes("/")) return null;
    // A final segment opening with `.` is a dotfile NAME (`.kairos/.gitignore`), a
    // configuration word rather than a coordinate.
    if ((file.split("/").pop() ?? file).startsWith(".")) return null;
    const first = groups.first === undefined ? undefined : Number(groups.first);
    const last = groups.last === undefined ? undefined : Number(groups.last);
    return {
      path: file,
      ...(first === undefined ? {} : { firstLine: first }),
      ...(last === undefined ? {} : { lastLine: last }),
    };
  }

  /** The ONE spelling of a path's normalization — a leading `./` and trailing slashes
   *  are prose, not coordinates. Every comparison in the rule plane goes through it, so
   *  two spellings of one location never read as two locations. */
  static normalize(written: string): string {
    return written.replace(/^\.\//, "").replace(/\/+$/, "");
  }

  /** The repo-relative coordinate a written link target names — the normalized spelling
   *  lifted to the slice's branded `RepoPath`. A markdown body writes a path as English
   *  prose (`../specs/x.md` · `./docs`), so the written form is normalized here and
   *  nowhere else; the one erasure is this method. */
  static relOf(written: string): RepoPath {
    return PathShape.normalize(written) as RepoPath;
  }
}
