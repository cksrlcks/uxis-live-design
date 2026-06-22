import { describe, it, expect } from "vitest";
import { matchNav, visibleNavItems, NAV_ITEMS } from "@/widgets/studio-shell/model/nav-config";

describe("nav-config", () => {
  it("matchNav: 섹션 루트 정확 일치", () => {
    expect(matchNav("/studio/proposals")?.label).toBe("시안");
    expect(matchNav("/studio/users")?.label).toBe("사용자 관리");
  });

  it("matchNav: 하위 경로도 같은 섹션 활성", () => {
    expect(matchNav("/studio/proposals/abc123")?.label).toBe("시안");
    expect(matchNav("/studio/proposals/new")?.label).toBe("시안");
  });

  it("matchNav: 알 수 없는 경로 → undefined", () => {
    expect(matchNav("/studio/unknown")).toBeUndefined();
  });

  it("matchNav: 접두만 같고 세그먼트가 다르면 매칭 안 함", () => {
    // '/studio/proposalsX'는 '/studio/proposals' 섹션이 아니다
    expect(matchNav("/studio/proposalsX")).toBeUndefined();
  });

  it("visibleNavItems: editor는 admin 전용 항목을 숨김", () => {
    const labels = visibleNavItems("editor").map((i) => i.label);
    expect(labels).toContain("시안");
    expect(labels).not.toContain("사용자 관리");
  });

  it("visibleNavItems: admin은 모든 항목을 봄", () => {
    expect(visibleNavItems("admin")).toHaveLength(NAV_ITEMS.length);
  });
});
