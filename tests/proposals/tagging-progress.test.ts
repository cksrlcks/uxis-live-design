import { describe, it, expect } from "vitest";
import { taggingPercent } from "@/entities/proposal/lib/tagging-progress";

describe("taggingPercent", () => {
  it("0/6 → 0", () => expect(taggingPercent(0, 6)).toBe(0));
  it("3/6 → 50", () => expect(taggingPercent(3, 6)).toBe(50));
  it("6/6 → 100", () => expect(taggingPercent(6, 6)).toBe(100));
  it("1/6 → 17 (반올림)", () => expect(taggingPercent(1, 6)).toBe(17));
  it("2/6 → 33 (반올림)", () => expect(taggingPercent(2, 6)).toBe(33));
  it("총 구분 0이면 0 (0으로 나누기 방지)", () => expect(taggingPercent(0, 0)).toBe(0));
});
