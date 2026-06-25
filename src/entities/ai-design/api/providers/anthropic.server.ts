import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiHtmlProvider, GenerateHtmlRequest } from "./types";

// 지연 초기화: 이 provider를 실제로 쓸 때만 ANTHROPIC_API_KEY를 요구한다.
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

// Anthropic Messages API(vision)로 HTML 시안 생성.
// 이미지 입력은 URL source를 그대로 사용(base64 변환 불필요).
export const anthropicProvider: AiHtmlProvider = {
  async generate({ model, system, userText, imageUrls, maxOutputTokens }: GenerateHtmlRequest): Promise<string> {
    const content: Anthropic.ContentBlockParam[] = [
      ...imageUrls.map(
        (url): Anthropic.ImageBlockParam => ({
          type: "image",
          source: { type: "url", url },
        }),
      ),
      { type: "text", text: userText },
    ];

    // max_tokens가 커서 응답이 10분을 넘길 수 있으므로 스트리밍 필수(SDK 요구).
    // finalMessage()로 완성된 메시지를 받아 text 블록을 합친다.
    const stream = getClient().messages.stream({
      model,
      max_tokens: maxOutputTokens,
      system,
      messages: [{ role: "user", content }],
    });
    const message = await stream.finalMessage();

    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  },
};
