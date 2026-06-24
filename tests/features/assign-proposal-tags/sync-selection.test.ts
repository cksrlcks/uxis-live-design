import { describe, it, expect } from "vitest";
import { shouldSyncSelection } from "@/features/assign-proposal-tags/lib/sync-selection";

describe("shouldSyncSelection", () => {
  // 회귀 방지: 저장 후 새로고침하면 로컬은 빈 Set, 서버엔 저장된 태그가 있다.
  // 최초 동기화는 dirty 여부와 무관하게 반드시 서버값을 반영해야 한다.
  it("최초 동기화: 로컬이 비어 있고 서버에 값이 있어도 반영한다", () => {
    expect(shouldSyncSelection(true, new Set(), ["a", "b", "c"])).toBe(true);
  });

  it("최초 동기화: 서버가 비어도 반영한다", () => {
    expect(shouldSyncSelection(true, new Set(), [])).toBe(true);
  });

  it("이후 refetch: 로컬==서버(미편집)면 반영한다", () => {
    expect(shouldSyncSelection(false, new Set(["a", "b"]), ["a", "b"])).toBe(true);
  });

  it("이후 refetch: 편집 중(로컬≠서버)이면 반영하지 않는다(미저장 보호)", () => {
    // 항목 빠짐
    expect(shouldSyncSelection(false, new Set(["a"]), ["a", "b"])).toBe(false);
    // 항목 추가/치환
    expect(shouldSyncSelection(false, new Set(["a", "x"]), ["a", "b"])).toBe(false);
  });
});
