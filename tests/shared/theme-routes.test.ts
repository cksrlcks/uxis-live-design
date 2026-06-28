import { describe, it, expect } from "vitest";
import { isDarkRoute } from "@/shared/lib/theme-routes";

describe("isDarkRoute — 스튜디오는 라이트", () => {
  it("스튜디오 경로는 다크가 아니다", () => {
    expect(isDarkRoute("/studio")).toBe(false);
    expect(isDarkRoute("/studio/proposals")).toBe(false);
    expect(isDarkRoute("/studio/proposals/abc123")).toBe(false);
  });
  it("스튜디오 외 다크 면은 유지", () => {
    expect(isDarkRoute("/me")).toBe(true);
    expect(isDarkRoute("/pending")).toBe(true);
    expect(isDarkRoute("/plugin-auth")).toBe(true);
  });
  it("공개/라이트 면은 라이트", () => {
    expect(isDarkRoute("/")).toBe(false);
    expect(isDarkRoute("/p/abc")).toBe(false);
  });
});
