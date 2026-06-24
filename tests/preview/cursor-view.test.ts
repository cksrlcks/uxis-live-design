import { describe, it, expect } from "vitest";
import { viewKey, isSameView } from "@/widgets/preview-canvas/lib/cursor-view";

describe("viewKey", () => {
  it("joins variant and version with a colon", () => {
    expect(viewKey("var-1", "ver-9")).toBe("var-1:ver-9");
  });
});

describe("isSameView", () => {
  it("true when both keys match", () => {
    expect(isSameView("a:1", "a:1")).toBe(true);
  });
  it("false when keys differ", () => {
    expect(isSameView("a:1", "a:2")).toBe(false);
    expect(isSameView("a:1", "b:1")).toBe(false);
  });
  it("treats missing info as same view (sharp fallback)", () => {
    expect(isSameView(undefined, "a:1")).toBe(true);
    expect(isSameView("a:1", undefined)).toBe(true);
    expect(isSameView(undefined, undefined)).toBe(true);
  });
});
