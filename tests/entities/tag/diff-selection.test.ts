import { describe, it, expect } from "vitest";
import { diffSelection } from "@/entities/tag/lib/diff-selection";

describe("diffSelection", () => {
  it("추가/삭제 계산", () => {
    expect(diffSelection(["a", "b"], ["b", "c"])).toEqual({ toAdd: ["c"], toRemove: ["a"] });
  });
  it("변경 없음 → 빈 diff", () => {
    expect(diffSelection(["a", "b"], ["a", "b"])).toEqual({ toAdd: [], toRemove: [] });
  });
  it("next 중복 제거", () => {
    expect(diffSelection([], ["a", "a"])).toEqual({ toAdd: ["a"], toRemove: [] });
  });
  it("전체 해제 → 전부 삭제", () => {
    expect(diffSelection(["a", "b"], [])).toEqual({ toAdd: [], toRemove: ["a", "b"] });
  });
});
