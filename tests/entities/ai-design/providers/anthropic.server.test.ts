import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// @anthropic-ai/sdk default export = class Anthropic; new Anthropic() → { messages: { stream } }.
// messages.stream(...)은 동기로 MessageStream을 반환하고, .finalMessage()로 완성 메시지를 받는다.
const { stream } = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream };
  },
}));

import { anthropicProvider } from "@/entities/ai-design/api/providers/anthropic.server";

beforeEach(() => vi.clearAllMocks());

describe("anthropicProvider", () => {
  it("이미지 URL + 텍스트를 Messages API 형태로 스트리밍 전달하고 text 블록을 합쳐 반환한다", async () => {
    stream.mockReturnValue({
      finalMessage: async () => ({
        content: [
          { type: "text", text: "<!DOCTYPE html>" },
          { type: "text", text: "<html></html>" },
        ],
      }),
    });

    const raw = await anthropicProvider.generate({
      model: "claude-sonnet-4-6",
      system: "시스템 프롬프트",
      userText: "사용자 텍스트",
      imageUrls: ["https://x/img.png"],
      maxOutputTokens: 100,
    });
    expect(raw).toBe("<!DOCTYPE html><html></html>");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arg = (stream.mock.calls as any[][])[0][0];
    expect(arg.model).toBe("claude-sonnet-4-6");
    expect(arg.system).toBe("시스템 프롬프트");
    expect(arg.max_tokens).toBe(100);
    // 이미지 블록(URL source)이 먼저, 텍스트 블록이 뒤
    expect(arg.messages[0].content[0]).toMatchObject({
      type: "image",
      source: { type: "url", url: "https://x/img.png" },
    });
    expect(arg.messages[0].content.at(-1)).toMatchObject({ type: "text", text: "사용자 텍스트" });
  });

  it("text 블록이 없으면 빈 문자열을 반환한다", async () => {
    stream.mockReturnValue({ finalMessage: async () => ({ content: [] }) });
    const raw = await anthropicProvider.generate({
      model: "claude-sonnet-4-6",
      system: "s",
      userText: "u",
      imageUrls: [],
      maxOutputTokens: 100,
    });
    expect(raw).toBe("");
  });
});
