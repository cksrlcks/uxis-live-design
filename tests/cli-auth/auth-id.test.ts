import { describe, it, expect } from "vitest";
// index.ts가 아닌 순수 모듈 경로로 import — index는 server-only 파일을 재수출해 vitest에서 못 쓴다.
import { isValidAuthId } from "@/entities/cli-auth/model/auth-id";

describe("isValidAuthId", () => {
  it("uuid v4 형식을 통과시킨다", () => {
    expect(isValidAuthId("0437efce-ce16-443d-bd03-497b7ca38dee")).toBe(true);
  });
  it("uuid가 아니면 거부한다 (pg uuid 캐스팅 500 방지)", () => {
    expect(isValidAuthId("abc")).toBe(false);
    expect(isValidAuthId("")).toBe(false);
    expect(isValidAuthId("0437efce-ce16-443d-bd03-497b7ca38de")).toBe(false); // 한 글자 부족
    expect(isValidAuthId("'; DROP TABLE cli_auth_sessions;--")).toBe(false);
  });
});
