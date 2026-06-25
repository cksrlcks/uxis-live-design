import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/guards.server", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));

const { after, runGeneration, insert, values } = vi.hoisted(() => {
  // after()는 콜백을 받기만 하고 자동 실행하지 않는다(응답 후 실행을 흉내). 테스트에서 수동 호출해 검증.
  const after = vi.fn((_cb: () => unknown) => undefined);
  const runGeneration = vi.fn(async () => undefined);
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  return { after, runGeneration, insert, values };
});
vi.mock("next/server", () => ({ after }));
vi.mock("@/entities/ai-design/api/run-generation.server", () => ({ runGeneration }));
vi.mock("@/shared/db", () => ({ db: { insert } }));

import { createAiDesign } from "@/entities/ai-design/api/create-ai-design.server";

beforeEach(() => vi.clearAllMocks());

describe("createAiDesign", () => {
  it("행을 working으로 삽입하고 태그를 넣고 생성을 after로 예약한다", async () => {
    const res = await createAiDesign({
      title: "ACME",
      pageType: "dashboard",
      optionIds: ["11111111-1111-4111-a111-111111111111"],
      extraNotes: "모던하게",
    });
    expect(res.id).toBeTruthy();
    // ai_designs insert
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ title: "ACME", pageType: "dashboard", status: "working", createdBy: "admin-1" }),
    );
    // after()로 생성 예약됨; 예약된 콜백은 runGeneration(id)를 호출한다
    expect(after).toHaveBeenCalledTimes(1);
    const scheduled = (after.mock.calls as any[][])[0][0] as () => unknown;
    await scheduled();
    expect(runGeneration).toHaveBeenCalledWith(res.id);
  });

  it("잘못된 입력은 zod에서 막히고 삽입/예약이 없다", async () => {
    await expect(createAiDesign({ title: "", pageType: "main" })).rejects.toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });
});
