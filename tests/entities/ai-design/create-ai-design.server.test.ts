import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/guards.server", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/entities/ai-design/workflow/generate-ai-design.workflow", () => ({
  generateAiDesignWorkflow: vi.fn(),
}));

const { start, insert, values } = vi.hoisted(() => {
  const start = vi.fn(async () => undefined);
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  return { start, insert, values };
});
vi.mock("workflow/api", () => ({ start }));
vi.mock("@/shared/db", () => ({ db: { insert } }));

import { createAiDesign } from "@/entities/ai-design/api/create-ai-design.server";

beforeEach(() => vi.clearAllMocks());

describe("createAiDesign", () => {
  it("행을 working으로 삽입하고 태그를 넣고 워크플로우를 트리거한다", async () => {
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
    // 워크플로우 트리거됨
    expect(start).toHaveBeenCalledTimes(1);
    expect((start.mock.calls as any[][])[0][1]).toEqual([res.id]);
  });

  it("잘못된 입력은 zod에서 막히고 삽입/트리거가 없다", async () => {
    await expect(createAiDesign({ title: "", pageType: "main" })).rejects.toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
