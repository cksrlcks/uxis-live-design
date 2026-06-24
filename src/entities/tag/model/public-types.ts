// 유시스웍스 공개 API용 태그 DTO. 안정 키(code)와 표시 라벨(label)을 함께 노출해
// 소비 측이 필터링·표시 모두 가능하게 한다.
export type PublicTag = {
  group: string; // tag_groups.code
  groupLabel: string; // tag_groups.label
  code: string; // tag_options.code
  label: string; // tag_options.label
};
