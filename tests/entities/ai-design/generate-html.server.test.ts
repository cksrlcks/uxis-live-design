import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// openai default export = class OpenAI; new OpenAI() → { responses: { create } }.
// vi.mock 팩토리는 import 위로 호이스트되므로 vi.hoisted로 mock fn을 먼저 만든다.
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { create };
  },
}));

import { generateHtml } from "@/entities/ai-design/api/generate-html.server";

beforeEach(() => vi.clearAllMocks());

describe("generateHtml", () => {
  it("코드펜스를 벗긴 HTML을 반환하고 이미지+텍스트 입력을 Responses API로 전달한다", async () => {
    create.mockResolvedValue({ output_text: "```html\n<!DOCTYPE html><html></html>\n```" });
    const html = await generateHtml(
      { title: "ACME", company: null, pageType: "main", tagLabels: ["미니멀"], extraNotes: null },
      ["https://x/img.png"],
    );
    expect(html).toBe("<!DOCTYPE html><html></html>");

    const arg = (create.mock.calls as any[][])[0][0];
    expect(arg.model).toBeTruthy();
    expect(arg.instructions).toContain("HTML");
    // 이미지 블록이 먼저, 텍스트 블록이 뒤
    expect(arg.input[0].content[0]).toMatchObject({ type: "input_image", image_url: "https://x/img.png" });
    expect(arg.input[0].content.at(-1)).toMatchObject({ type: "input_text" });
  });

  it("빈 응답이면 EMPTY_GENERATION을 던진다", async () => {
    create.mockResolvedValue({ output_text: "   " });
    await expect(
      generateHtml({ title: "A", company: null, pageType: "main", tagLabels: [], extraNotes: null }, []),
    ).rejects.toThrow("EMPTY_GENERATION");
  });
});
