// packages/cdd-engine/src/infra/__tests__/infra.log.test.ts
// New dependency point for ALL logging in rebuilt infra: consumers import `log` and go through
// consola (level-gated), never console.*. Changed level applies to subsequent calls (gate works).
import { describe, it, expect } from "vitest";

import { log, setLogLevel } from "../log.ts";

describe("infra/log.ts", () => {
  it("exports a consola instance with the standard log methods", () => {
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("default level is info (3)", () => {
    expect(log.level).toBe(3);
  });

  it("setLogLevel mutates the shared instance level", () => {
    setLogLevel(1);
    expect(log.level).toBe(1);
    setLogLevel(3);
    expect(log.level).toBe(3);
  });
});
