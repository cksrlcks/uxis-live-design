import { describe, it, expect } from "vitest";
import { statusPillVariant } from "@/shared/ui/status-pill/tone";

describe("statusPillVariant — 도메인 tone → Badge variant", () => {
  it("통과 매핑", () => {
    expect(statusPillVariant("info")).toBe("info");
    expect(statusPillVariant("success")).toBe("success");
    expect(statusPillVariant("warning")).toBe("warning");
    expect(statusPillVariant("neutral")).toBe("neutral");
  });
  it("이름이 다른 매핑", () => {
    expect(statusPillVariant("danger")).toBe("error");
    expect(statusPillVariant("role")).toBe("purple");
  });
});
