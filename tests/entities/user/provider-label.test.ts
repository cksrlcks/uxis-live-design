import { describe, it, expect } from "vitest";
import { providerLabel } from "@/entities/user/lib/provider-label";

describe("providerLabel", () => {
  it("maps email to 이메일", () => {
    expect(providerLabel("email")).toBe("이메일");
  });
  it("maps google to 구글", () => {
    expect(providerLabel("google")).toBe("구글");
  });
  it("returns an unknown provider verbatim", () => {
    expect(providerLabel("apple")).toBe("apple");
    expect(providerLabel("kakao")).toBe("kakao");
  });
});
