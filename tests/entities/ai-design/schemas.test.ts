import { describe, it, expect } from "vitest";
import { createAiDesignSchema } from "@/entities/ai-design/model/schemas";

describe("createAiDesignSchema", () => {
  it("최소 유효 입력을 통과시킨다", () => {
    const parsed = createAiDesignSchema.parse({ title: "ACME", pageType: "main" });
    expect(parsed.title).toBe("ACME");
    expect(parsed.optionIds).toEqual([]);
  });

  it("title 공백을 trim하고 빈 title을 거부한다", () => {
    expect(() => createAiDesignSchema.parse({ title: "   ", pageType: "main" })).toThrow();
  });

  it("잘못된 pageType을 거부한다", () => {
    expect(() => createAiDesignSchema.parse({ title: "A", pageType: "landing" })).toThrow();
  });

  it("optionIds는 uuid 배열이어야 한다", () => {
    expect(() => createAiDesignSchema.parse({ title: "A", pageType: "main", optionIds: ["nope"] })).toThrow();
  });
});
