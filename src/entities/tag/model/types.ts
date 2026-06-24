// 클라이언트로 넘기는 태그 DTO(날짜 제외, sortOrder는 number).
export type TagGroup = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

export type TagOption = {
  id: string;
  groupId: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

export type TagGroupWithOptions = TagGroup & { options: TagOption[] };
export type Taxonomy = TagGroupWithOptions[];

// 시안 1건의 현재 선택 옵션 id 집합.
export type ProposalTags = { optionIds: string[] };
