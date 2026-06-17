import { describe, it, expect } from "vitest";
import { isSameOrigin } from "@/shared/api/same-origin";

describe("isSameOrigin", () => {
  it("returns true when origin host matches host header", () => {
    expect(isSameOrigin("https://app.example.com", "app.example.com")).toBe(true);
  });
  it("returns false on host mismatch", () => {
    expect(isSameOrigin("https://evil.com", "app.example.com")).toBe(false);
  });
  it("returns false when origin or host is missing", () => {
    expect(isSameOrigin(null, "app.example.com")).toBe(false);
    expect(isSameOrigin("https://app.example.com", null)).toBe(false);
  });
  it("returns false on malformed origin", () => {
    expect(isSameOrigin("not-a-url", "app.example.com")).toBe(false);
  });
});
