export const PAGE_TYPES = ["main", "dashboard", "subpage"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  main: "메인",
  dashboard: "대시보드",
  subpage: "서브페이지",
};

export const AI_DESIGN_STATUSES = ["working", "done", "failed"] as const;
export type AiDesignStatus = (typeof AI_DESIGN_STATUSES)[number];

export const AI_DESIGN_STATUS_LABELS: Record<AiDesignStatus, string> = {
  working: "작업중",
  done: "완료",
  failed: "실패",
};

// 생성 모달에서 고를 수 있는 모델 화이트리스트. value는 DB·생성에 그대로 저장·사용된다.
// 모델이 제공사(provider)를 결정한다 — 생성 시 이 매핑으로 provider를 고른다. 모두 비전 지원 모델.
export const AI_MODEL_OPTIONS = [
  { value: "gpt-5.5", label: "GPT-5.5 (OpenAI)", provider: "openai" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Anthropic)", provider: "anthropic" },
] as const;

export type AiModelValue = (typeof AI_MODEL_OPTIONS)[number]["value"];

// 화이트리스트 검증용 값 배열.
export const AI_MODEL_VALUES = AI_MODEL_OPTIONS.map((m) => m.value) as AiModelValue[];

// model → provider 매핑. 알 수 없는 모델이면 AI_PROVIDER로 폴백한다.
export const PROVIDER_BY_MODEL = Object.fromEntries(
  AI_MODEL_OPTIONS.map((m) => [m.value, m.provider]),
) as Record<string, string>;

// 모델 미지정 시 기본 제공사. env(AI_PROVIDER)로 교체 가능: "openai" | "anthropic". 기본 openai.
export const AI_PROVIDER = (process.env.AI_PROVIDER ?? "openai").toLowerCase();

// 모델 미지정 시 기본 모델. env로 각각 교체 가능.
const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  openai: process.env.OPENAI_MODEL ?? "gpt-5.5",
  anthropic: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
};
export const AI_DESIGN_MODEL =
  DEFAULT_MODEL_BY_PROVIDER[AI_PROVIDER] ?? DEFAULT_MODEL_BY_PROVIDER.openai;

// 모달에 노출할 태그 그룹 코드 화이트리스트(생성에 유용한 것만).
// 시드(0016_seed_tags.sql)의 실제 group.code와 일치해야 한다 — 구현 시 확인하고,
// taxonomy에 없는 코드는 무시되며(아래 모달 로직), 하나도 없으면 전체 그룹을 노출한다.
export const MODAL_TAG_GROUP_CODES = ["field", "style", "target", "structure"];
