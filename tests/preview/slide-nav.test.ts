import { describe, it, expect } from "vitest";
import { nextIndex, prevIndex } from "@/legacy/lib/preview/slide-nav";

describe("slide navigation (wrap-around)", () => {
  it("advances and loops from the last page back to the first", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(1, 3)).toBe(2);
    expect(nextIndex(2, 3)).toBe(0);
  });
  it("retreats and loops from the first page back to the last", () => {
    expect(prevIndex(2, 3)).toBe(1);
    expect(prevIndex(1, 3)).toBe(0);
    expect(prevIndex(0, 3)).toBe(2);
  });
  it("stays at 0 for an empty list", () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 0)).toBe(0);
  });
});
