export const PAGE_TYPES = ["main", "dashboard", "subpage"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const AI_DESIGN_STATUSES = ["working", "done", "failed"] as const;
export type AiDesignStatus = (typeof AI_DESIGN_STATUSES)[number];

// env로 교체 가능. 기본은 사용자가 선택한 Sonnet 4.6.
export const AI_DESIGN_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

// 모달에 노출할 태그 그룹 코드 화이트리스트(생성에 유용한 것만).
// 시드(0016_seed_tags.sql)의 실제 group.code와 일치해야 한다 — 구현 시 확인하고,
// taxonomy에 없는 코드는 무시되며(아래 모달 로직), 하나도 없으면 전체 그룹을 노출한다.
export const MODAL_TAG_GROUP_CODES = ["field", "style", "target", "structure"];
