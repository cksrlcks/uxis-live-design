// 시안 사전 분석의 고정 분류 체계 + 분석 기준 버전/모델.
// SECTION_TYPES는 drizzle/schema.ts의 proposal_section_analysis.section_type check와 동기화를 유지한다.
//
// FSD: 이 엔티티(design-analysis)는 ai-design을 import하지 않는다. Phase 2에서 ai-design → design-analysis
// 방향으로 의존하므로, 순환을 피하려 provider/모델 기본값은 여기서 env를 직접 읽어 자체 완결한다.

// 분석 기준 버전. 프롬프트/분류 기준이 바뀌면 올린다 → (page_id, analysis_version)로 재분석이 트리거된다.
export const ANALYSIS_VERSION = "v1";

// 섹션 타입 14종(고정). 데이터 오염을 막기 위해 분석은 이 집합 안에서만 분류한다.
export const SECTION_TYPES = [
  "hero",
  "intro",
  "about",
  "service",
  "product",
  "portfolio",
  "gallery",
  "process",
  "pricing",
  "review",
  "faq",
  "contact",
  "cta",
  "footer",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

// 컴포넌트 타입 15종(고정). 섹션의 components(jsonb)에 인라인된다.
export const COMPONENT_TYPES = [
  "button",
  "card",
  "tab",
  "accordion",
  "slider",
  "search",
  "form",
  "badge",
  "stats",
  "timeline",
  "stepper",
  "thumbnail",
  "profile-card",
  "review-card",
  "pricing-card",
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const ANALYSIS_STATUSES = ["pending", "analyzed", "failed", "skipped"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

// 분석 시스템 프롬프트를 DB에서 편집할 때 쓰는 ai_settings 키(기존 system_prompt와 같은 저장소).
export const ANALYSIS_SYSTEM_PROMPT_KEY = "analysis_system_prompt";

// 기본 제공사(생성과 동일한 env 축을 읽지만 ai-design을 import하진 않는다).
const DEFAULT_PROVIDER = (process.env.AI_PROVIDER ?? "openai").toLowerCase();

// 분석 기본 모델. 비전 필수. env로 각각 교체 가능.
export const ANALYSIS_MODEL =
  process.env.AI_ANALYSIS_MODEL ??
  (DEFAULT_PROVIDER === "anthropic"
    ? (process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6")
    : (process.env.OPENAI_MODEL ?? "gpt-5.5"));

// model → provider 결정. 생성 화이트리스트와 같은 2개 모델을 다룬다(claude* → anthropic, 그 외 → openai).
export function analysisProviderFor(model: string): "anthropic" | "openai" {
  return model.toLowerCase().includes("claude") ? "anthropic" : "openai";
}

// 분석 출력 토큰 상한. JSON 한 건은 보통 2~4k면 충분. 기본 4000.
export const ANALYSIS_MAX_OUTPUT_TOKENS = (() => {
  const n = Number(process.env.AI_ANALYSIS_MAX_OUTPUT_TOKENS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 4000;
})();
