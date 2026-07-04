import { describe, it, expect } from "vitest";
import { parsePageAnalysis } from "@/entities/design-analysis/model/schemas";

describe("parsePageAnalysis", () => {
  it("유효한 분석 JSON을 파싱하고 알려진 컴포넌트를 유지한다", () => {
    const r = parsePageAnalysis({
      overall: { industry: "스키강습", tone: "활동적", styleKeywords: ["seasonal"], summary: "s", promptSnippet: "p" },
      sections: [
        {
          sectionType: "hero",
          layoutType: "centered-visual",
          colorPalette: ["#000"],
          components: [{ type: "cta-button-wrong" }, { type: "button", styleKeywords: ["solid"] }],
          summary: "hero 요약",
          promptSnippet: "겨울 시즌감 히어로",
        },
      ],
    });
    expect(r.overall.industry).toBe("스키강습");
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].sectionType).toBe("hero");
    // 알 수 없는 컴포넌트 타입(cta-button-wrong)은 제거되고 button만 남는다.
    expect(r.sections[0].components.map((c) => c.type)).toEqual(["button"]);
  });

  it("알 수 없는 section_type 섹션은 통째로 드롭한다", () => {
    const r = parsePageAnalysis({
      overall: {},
      sections: [{ sectionType: "nonexistent" }, { sectionType: "footer" }],
    });
    expect(r.sections.map((s) => s.sectionType)).toEqual(["footer"]);
  });

  it("객체가 아니거나 sections가 없으면 안전하게 빈 결과를 반환한다", () => {
    expect(parsePageAnalysis("garbage").sections).toEqual([]);
    expect(parsePageAnalysis(null).sections).toEqual([]);
    const r = parsePageAnalysis({ overall: { tone: "x" } });
    expect(r.sections).toEqual([]);
    expect(r.overall.tone).toBe("x");
    expect(r.overall.styleKeywords).toEqual([]);
  });
});
