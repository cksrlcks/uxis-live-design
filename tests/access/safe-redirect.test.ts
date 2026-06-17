import { describe, it, expect } from "vitest";
import { isSafeInternalPath } from "@/legacy/lib/access/safe-redirect";

describe("isSafeInternalPath", () => {
  it("accepts internal absolute paths", () => {
    expect(isSafeInternalPath("/p/abc")).toBe(true);
    expect(isSafeInternalPath("/p/abc?v=a")).toBe(true);
    expect(isSafeInternalPath("/dashboard")).toBe(true);
  });
  it("rejects non-strings / empty", () => {
    expect(isSafeInternalPath(null)).toBe(false);
    expect(isSafeInternalPath(undefined)).toBe(false);
    expect(isSafeInternalPath("")).toBe(false);
  });
  it("rejects protocol-relative and backslash tricks (open redirect)", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
  });
  it("rejects paths not starting with /", () => {
    expect(isSafeInternalPath("p/abc")).toBe(false);
  });
});
