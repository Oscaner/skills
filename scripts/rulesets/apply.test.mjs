import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The gh CLI is the outbound seam — every ruleset interaction goes through
// execaSync("gh", ...), so the module seam for unit tests is execaSync.
vi.mock("execa", () => ({ execaSync: vi.fn() }));

import { execaSync } from "execa";
import { main, TARGETS } from "./apply.mjs";

const mocked = vi.mocked(execaSync);

describe("apply.mjs — target validation", () => {
  beforeEach(() => {
    delete process.env.GITHUB_REPOSITORY;
    mocked.mockReset();
  });

  it("returns exit code 1 for an unknown target", () => {
    expect(main("bogus")).toBe(1);
  });

  it("returns exit code 1 when no target is given", () => {
    expect(main(undefined)).toBe(1);
  });

  it("does not shell out to gh on validation failure", () => {
    main("bogus");
    expect(mocked).not.toHaveBeenCalled();
  });
});

describe("apply.mjs — ruleset dispatch", () => {
  beforeEach(() => {
    delete process.env.GITHUB_REPOSITORY;
    mocked.mockReset();
    mocked.mockReturnValue({ stdout: "" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is a no-op creation path only when the ruleset is absent", () => {
    expect(main("protect-develop")).toBe(0);
    // query existing rulesets first (returns empty stdout → no current id)…
    expect(mocked).toHaveBeenNthCalledWith(
      1,
      "gh",
      ["api", "repos/Oscaner/skills/rulesets", "--jq", '.[] | select(.name=="protect-develop") | .id'],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    // …then POST the moved protect-develop payload.
    expect(mocked).toHaveBeenNthCalledWith(
      2,
      "gh",
      [
        "api",
        "repos/Oscaner/skills/rulesets",
        "-X",
        "POST",
        "--input",
        expect.stringMatching(/configs\/develop\.json$/),
      ],
      { stdio: "inherit" },
    );
  });

  it("resolves the protect-main payload from configs/main.json", () => {
    expect(main("protect-main")).toBe(0);
    expect(mocked.mock.calls[0][1][3]).toBe('.[] | select(.name=="protect-main") | .id');
    const post = mocked.mock.calls.find(([, args]) => args.includes("-X"));
    expect(post[1]).toEqual(
      expect.arrayContaining([
        "--input",
        expect.stringMatching(/configs\/main\.json$/),
      ]),
    );
  });

  it("does not POST when the ruleset already exists — prints recreate commands and exits 1", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mocked.mockReset();
    mocked.mockReturnValueOnce({ stdout: "42\n" });

    expect(() => main("protect-main")).toThrow("process.exit");
    expect(exit).toHaveBeenCalledWith(1);
    expect(mocked).toHaveBeenCalledTimes(1); // no POST on the existing-ruleset path
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Ruleset protect-main already exists (42)"),
    );
    expect(log.mock.calls.map((c) => c[0]).join("\n")).toMatch(/gh api repos\/Oscaner\/skills\/rulesets\/42 -X DELETE\n/);
  });
});

describe("apply.mjs — moved config layout", () => {
  it("maps exactly the two branch-protection targets", () => {
    expect(Object.keys(TARGETS).sort()).toEqual(["protect-develop", "protect-main"]);
  });

  it("resolves every target payload file under scripts/rulesets/configs", () => {
    for (const [target, rel] of Object.entries(TARGETS)) {
      expect(rel).toMatch(/^configs\/[a-z-]+\.json$/);
      expect(existsSync(fileURLToPath(new URL(`./${rel}`, import.meta.url)))).toBe(true);
    }
  });

  it("drops the legacy old-path constants from the apply source", () => {
    const src = readFileSync(new URL("./apply.mjs", import.meta.url), "utf8");
    expect(src).not.toMatch(/scripts\/gh-branch-rulesets/);
  });
});