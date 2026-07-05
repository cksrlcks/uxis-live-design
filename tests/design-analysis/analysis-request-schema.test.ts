import { describe, it, expect } from "vitest";
import { pendingRequestSchema } from "@/entities/design-analysis/model/analysis-request-schema";

describe("pendingRequestSchema", () => {
  it("pending 모드는 proposalId 없이 통과한다", () => {
    const r = pendingRequestSchema.parse({ mode: "pending" });
    expect(r.mode).toBe("pending");
  });

  it("reanalyze 모드는 proposalId(uuid)가 있어야 통과한다", () => {
    const ok = pendingRequestSchema.parse({
      mode: "reanalyze",
      proposalId: "11111111-1111-4111-a111-111111111111",
    });
    expect(ok.proposalId).toBe("11111111-1111-4111-a111-111111111111");
  });

  it("reanalyze인데 proposalId가 없으면 실패한다", () => {
    expect(() => pendingRequestSchema.parse({ mode: "reanalyze" })).toThrow();
  });

  it("proposalId가 uuid가 아니면 실패한다", () => {
    expect(() => pendingRequestSchema.parse({ mode: "reanalyze", proposalId: "nope" })).toThrow();
  });

  it("잘못된 mode는 실패한다", () => {
    expect(() => pendingRequestSchema.parse({ mode: "delete" })).toThrow();
  });
});

import { saveRequestSchema } from "@/entities/design-analysis/model/analysis-request-schema";

describe("saveRequestSchema", () => {
  const one = { pageId: "11111111-1111-4111-a111-111111111111", overall: {}, sections: [] };

  it("model 기본값은 claude-code", () => {
    const r = saveRequestSchema.parse({ analyses: [one] });
    expect(r.model).toBe("claude-code");
  });

  it("analyses가 비면 실패한다", () => {
    expect(() => saveRequestSchema.parse({ analyses: [] })).toThrow();
  });

  it("pageId가 uuid가 아니면 실패한다", () => {
    expect(() => saveRequestSchema.parse({ analyses: [{ ...one, pageId: "nope" }] })).toThrow();
  });
});
