import { describe, it, expect } from "vitest";
import { clampIndex, nextIndex, prevIndex } from "@/lib/preview/slide-nav";

describe("slide navigation", () => {
  it("clamps within [0, count-1]", () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(99, 5)).toBe(4);
    expect(clampIndex(2, 5)).toBe(2);
  });
  it("returns 0 for an empty list", () => {
    expect(clampIndex(0, 0)).toBe(0);
  });
  it("advances but stops at the last page", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(2);
  });
  it("retreats but stops at the first page", () => {
    expect(prevIndex(2, 3)).toBe(1);
    expect(prevIndex(0, 3)).toBe(0);
  });
});
