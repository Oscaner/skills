// The entry guard's own pins — the symlink arm is the one 4.21.0 shipped without.
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { invokedAs } from "../entry-guard.ts";

const scratch = mkdtempSync(path.join(tmpdir(), "cdd-entry-guard-"));
const target = path.join(scratch, "bin.js");
writeFileSync(target, "// stand-in for the built entry\n");
const link = path.join(scratch, "cdd");
symlinkSync(target, link);

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("the entry question", () => {
  it("answers yes when argv[1] is the module's own path", () => {
    expect(invokedAs(pathToFileURL(target).href, ["node", target])).toBe(true);
  });

  it("answers yes when argv[1] is a symlink to it — the shape every package bin has", () => {
    expect(invokedAs(pathToFileURL(target).href, ["node", link])).toBe(true);
  });

  it("answers no for another script, and for no argv[1] at all", () => {
    const other = path.join(scratch, "other.js");
    writeFileSync(other, "// another entry\n");
    expect(invokedAs(pathToFileURL(target).href, ["node", other])).toBe(false);
    expect(invokedAs(pathToFileURL(target).href, ["node"])).toBe(false);
  });

  it("answers no rather than throwing when argv[1] names no file", () => {
    expect(invokedAs(pathToFileURL(target).href, ["node", path.join(scratch, "gone.js")])).toBe(
      false,
    );
  });
});
