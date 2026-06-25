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
  it("분석/도입 태그와 HTML을 파싱해 반환하고 이미지+텍스트 입력을 Responses API로 전달한다", async () => {
    create.mockResolvedValue({
      output_text:
        "<분석>참고 시안은 미니멀합니다.</분석>\n<도입>여백과 그리드를 반영했습니다.</도입>\n```html\n<!DOCTYPE html><html></html>\n```",
    });
    const result = await generateHtml(
      { title: "ACME", company: null, pageType: "main", tagLabels: ["미니멀"], extraNotes: null },
      ["https://x/img.png"],
      "gpt-5.5",
    );
    expect(result.html).toBe("<!DOCTYPE html><html></html>");
    expect(result.analysis).toBe("참고 시안은 미니멀합니다.");
    expect(result.approach).toBe("여백과 그리드를 반영했습니다.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arg = (create.mock.calls as any[][])[0][0];
    expect(arg.model).toBe("gpt-5.5");
    expect(arg.instructions).toContain("HTML");
    // 이미지 블록이 먼저, 텍스트 블록이 뒤
    expect(arg.input[0].content[0]).toMatchObject({ type: "input_image", image_url: "https://x/img.png" });
    expect(arg.input[0].content.at(-1)).toMatchObject({ type: "input_text" });
  });

  it("태그가 없으면 분석/도입은 null이고 HTML만 파싱한다(하위호환)", async () => {
    create.mockResolvedValue({ output_text: "```html\n<!DOCTYPE html><body>x</body></html>\n```" });
    const result = await generateHtml(
      { title: "A", company: null, pageType: "main", tagLabels: [], extraNotes: null },
      [],
      "gpt-5.5",
    );
    expect(result.html).toBe("<!DOCTYPE html><body>x</body></html>");
    expect(result.analysis).toBeNull();
    expect(result.approach).toBeNull();
  });

  it("빈 응답이면 EMPTY_GENERATION을 던진다", async () => {
    create.mockResolvedValue({ output_text: "   " });
    await expect(
      generateHtml({ title: "A", company: null, pageType: "main", tagLabels: [], extraNotes: null }, [], "gpt-5.5"),
    ).rejects.toThrow("EMPTY_GENERATION");
  });
});
