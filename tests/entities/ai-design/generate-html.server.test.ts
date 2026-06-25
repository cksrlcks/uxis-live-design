import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { finalMessage, streamFn } = vi.hoisted(() => {
  const finalMessage = vi.fn();
  const streamFn = vi.fn(() => ({ finalMessage }));
  return { finalMessage, streamFn };
});

// @anthropic-ai/sdk default export = class Anthropic; new Anthropic() → { messages: { stream } }
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: streamFn };
  },
}));

import { generateHtml } from "@/entities/ai-design/api/generate-html.server";

beforeEach(() => vi.clearAllMocks());

describe("generateHtml", () => {
  it("코드펜스를 벗긴 HTML 텍스트를 반환한다", async () => {
    finalMessage.mockResolvedValue({
      content: [{ type: "text", text: "```html\n<!DOCTYPE html><html></html>\n```" }],
    });
    const html = await generateHtml(
      { title: "ACME", company: null, pageType: "main", tagLabels: ["미니멀"], extraNotes: null },
      ["https://x/img.png"],
    );
    expect(html).toBe("<!DOCTYPE html><html></html>");
    // 이미지 블록 + 텍스트 블록이 전달됐는지
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arg = (streamFn.mock.calls as any[][])[0][0];
    expect(arg.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "url" } });
    expect(arg.model).toBeTruthy();
  });

  it("빈 응답이면 EMPTY_GENERATION을 던진다", async () => {
    finalMessage.mockResolvedValue({ content: [{ type: "text", text: "   " }] });
    await expect(
      generateHtml({ title: "A", company: null, pageType: "main", tagLabels: [], extraNotes: null }, []),
    ).rejects.toThrow("EMPTY_GENERATION");
  });
});
