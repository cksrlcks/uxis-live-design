import { describe, it, expect } from "vitest";
import { decideAccess } from "@/lib/proposals/access";

describe("decideAccess", () => {
  it("allows editors regardless of visibility", () => {
    expect(decideAccess({ visibility: "private", hasPassword: true, isEditor: true, hasValidUnlock: false })).toBe("allow");
  });
  it("forbids non-editors on private", () => {
    expect(decideAccess({ visibility: "private", hasPassword: false, isEditor: false, hasValidUnlock: false })).toBe("forbidden");
  });
  it("allows anyone on public without a password", () => {
    expect(decideAccess({ visibility: "public", hasPassword: false, isEditor: false, hasValidUnlock: false })).toBe("allow");
  });
  it("requires password on public+password without unlock", () => {
    expect(decideAccess({ visibility: "public", hasPassword: true, isEditor: false, hasValidUnlock: false })).toBe("need-password");
  });
  it("allows public+password once unlocked", () => {
    expect(decideAccess({ visibility: "public", hasPassword: true, isEditor: false, hasValidUnlock: true })).toBe("allow");
  });
});
