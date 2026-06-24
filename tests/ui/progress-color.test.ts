import { describe, it, expect } from "vitest";
import { progressRingColor } from "@/shared/ui/progress-ring/progress-color";

describe("progressRingColor (4단계 구간)", () => {
  it("0% → 회색", () => expect(progressRingColor(0)).toBe("var(--color-muted-foreground)"));
  it("1~33% → 빨강", () => {
    expect(progressRingColor(1)).toBe("var(--color-error)");
    expect(progressRingColor(33)).toBe("var(--color-error)");
  });
  it("34~66% → 주황", () => {
    expect(progressRingColor(34)).toBe("var(--color-accent-orange)");
    expect(progressRingColor(66)).toBe("var(--color-accent-orange)");
  });
  it("67~99% → 파랑", () => {
    expect(progressRingColor(67)).toBe("var(--color-info)");
    expect(progressRingColor(99)).toBe("var(--color-info)");
  });
  it("100% → 초록", () => expect(progressRingColor(100)).toBe("var(--color-success)"));
});
