import { z } from "zod";
import { SECTION_TYPES, COMPONENT_TYPES } from "./constants";

const KNOWN_COMPONENTS = new Set<string>(COMPONENT_TYPES);
const strList = z
  .array(z.string().trim().min(1))
  .catch([])
  .default([]);

// 컴포넌트 type은 enum으로 강제하지 않고 문자열로 받은 뒤 parsePageAnalysis에서 알려진 집합으로 필터한다
// (오프-enum 컴포넌트 하나 때문에 섹션 전체가 버려지지 않도록).
export const analysisComponentSchema = z.object({
  type: z.string().trim().min(1),
  styleKeywords: strList,
  usage: z.string().nullish(),
});

export const analysisSectionSchema = z.object({
  sectionType: z.enum(SECTION_TYPES),
  layoutType: z.string().nullish(),
  tone: z.string().nullish(),
  backgroundType: z.string().nullish(),
  colorPalette: strList,
  components: z.array(analysisComponentSchema).catch([]).default([]),
  summary: z.string().nullish(),
  promptSnippet: z.string().nullish(),
});

export const analysisOverallSchema = z.object({
  industry: z.string().nullish(),
  tone: z.string().nullish(),
  styleKeywords: strList,
  summary: z.string().nullish(),
  promptSnippet: z.string().nullish(),
});

export const pageAnalysisSchema = z.object({
  overall: analysisOverallSchema,
  sections: z.array(analysisSectionSchema).default([]),
});

export type AnalysisComponent = z.infer<typeof analysisComponentSchema>;
export type AnalysisSection = z.infer<typeof analysisSectionSchema>;
export type AnalysisOverall = z.infer<typeof analysisOverallSchema>;
export type PageAnalysisResult = z.infer<typeof pageAnalysisSchema>;

// LLM 출력은 불완전할 수 있다 → overall은 관대하게 채우고, sections는 건별 검증해 유효한 것만 남긴다.
// 알 수 없는 section_type은 섹션째 드롭, 알 수 없는 component type은 컴포넌트만 드롭한다.
export function parsePageAnalysis(raw: unknown): PageAnalysisResult {
  const root = z
    .object({ overall: z.unknown(), sections: z.unknown() })
    .partial()
    .safeParse(raw);
  const data = root.success ? root.data : {};

  const overall = analysisOverallSchema.parse(
    data.overall && typeof data.overall === "object" ? data.overall : {},
  );

  const rawSections = Array.isArray(data.sections) ? data.sections : [];
  const sections: AnalysisSection[] = [];
  for (const s of rawSections) {
    const parsed = analysisSectionSchema.safeParse(s);
    if (!parsed.success) continue;
    parsed.data.components = parsed.data.components.filter((c) => KNOWN_COMPONENTS.has(c.type));
    sections.push(parsed.data);
  }

  return { overall, sections };
}
