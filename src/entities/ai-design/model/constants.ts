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

// === 생성 성능 튜닝 노브 (provider 공통) ===
// 재배포 없이 env로 조정 가능. 기본값은 "60초 이내" 목표의 균형 설정.
// 두 값 모두 OpenAI/Anthropic 경로에 함께 적용된다.
function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// 참고 이미지 최대 장수. 적을수록 비전 prefill 토큰↓ → 첫 토큰까지 빨라짐(참고 다양성 트레이드오프).
// 매칭수 정렬이라 상위 N개가 가장 관련도 높은 시안이다. 기본 6.
export const AI_MAX_REFERENCE_IMAGES = parsePositiveInt(process.env.AI_MAX_REFERENCE_IMAGES, 6);

// 출력 토큰 상한. 단일 HTML 시안은 보통 3~8k면 충분. (추론 모델은 추론 토큰도 이 상한에 포함되므로
// reasoning effort를 낮게 유지해야 출력이 잘리지 않는다.) 기본 16000.
export const AI_MAX_OUTPUT_TOKENS = parsePositiveInt(process.env.AI_MAX_OUTPUT_TOKENS, 16000);
