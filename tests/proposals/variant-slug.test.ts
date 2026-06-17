import { describe, it, expect } from "vitest";
import { nextVariantSlug, defaultVariantLabel } from "@/shared/lib/proposals/variant-slug";

describe("nextVariantSlug", () => {
  it("returns 'a' when nothing is used", () => {
    expect(nextVariantSlug([])).toBe("a");
  });
  it("returns the first unused lowercase letter", () => {
    expect(nextVariantSlug(["a"])).toBe("b");
    expect(nextVariantSlug(["a", "b", "d"])).toBe("c");
  });
  it("falls back to a 4-char id once a..z are all taken", () => {
    const used = "abcdefghijklmnopqrstuvwxyz".split("");
    const slug = nextVariantSlug(used);
    expect(slug).toHaveLength(4);
    expect(used).not.toContain(slug);
  });
  it("fallback never collides with an existing slug", () => {
    const used = "abcdefghijklmnopqrstuvwxyz".split("");
    for (let i = 0; i < 50; i++) {
      const slug = nextVariantSlug(used);
      expect(used).not.toContain(slug);
    }
  });
});

describe("defaultVariantLabel", () => {
  it("maps 0-based index to A, B, ... Z", () => {
    expect(defaultVariantLabel(0)).toBe("A");
    expect(defaultVariantLabel(1)).toBe("B");
    expect(defaultVariantLabel(25)).toBe("Z");
  });
  it("falls back to '안 N' past 26", () => {
    expect(defaultVariantLabel(26)).toBe("안 27");
  });
});
