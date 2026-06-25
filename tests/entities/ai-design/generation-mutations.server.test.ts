import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/entities/ai-design/api/get-tag-matched-images.server", () => ({
  getTagMatchedImages: vi.fn(async () => [{ proposalId: "p1", url: "https://x/a.png" }]),
}));

// db.update(...).set(...).where(...) 체인
const { update, set, where, selectChain } = vi.hoisted(() => {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const selectChain = vi.fn();
  return { update, set, where, selectChain };
});
vi.mock("@/shared/db", () => ({ db: { update, select: selectChain } }));

import { markDone, markFailed, resolveReferences } from "@/entities/ai-design/api/generation-mutations.server";

beforeEach(() => vi.clearAllMocks());

describe("generation mutations", () => {
  it("markDone: status=done, html 설정", async () => {
    await markDone("d1", "<html></html>");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "done", html: "<html></html>" }));
    expect(where).toHaveBeenCalled();
  });

  it("markFailed: status=failed, 메시지 500자 제한", async () => {
    await markFailed("d1", "x".repeat(600));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arg = (set.mock.calls as any[][])[0][0];
    expect(arg.status).toBe("failed");
    expect(arg.errorMessage.length).toBe(500);
  });

  it("resolveReferences: 행이 없으면 NOT_FOUND", async () => {
    // 1st select() → ai_designs row (빈 결과)
    selectChain.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });
    await expect(resolveReferences("missing")).rejects.toThrow("NOT_FOUND");
  });
});
