import "server-only";
import OpenAI from "openai";
import type { AiHtmlProvider, GenerateHtmlRequest } from "./types";

// 클라이언트는 최초 사용 시점에 생성(다른 provider 사용 시 OPENAI_API_KEY를 요구하지 않도록 지연 초기화).
let client: OpenAI | null = null;
const getClient = () => (client ??= new OpenAI());

// OpenAI Responses API(vision)로 HTML 시안 생성.
export const openaiProvider: AiHtmlProvider = {
  async generate({ model, system, userText, imageUrls, maxOutputTokens }: GenerateHtmlRequest): Promise<string> {
    const content: OpenAI.Responses.ResponseInputMessageContentList = [
      ...imageUrls.map(
        (url): OpenAI.Responses.ResponseInputImage => ({
          type: "input_image",
          image_url: url,
          detail: "auto",
        }),
      ),
      { type: "input_text", text: userText },
    ];

    const response = await getClient().responses.create({
      model,
      instructions: system,
      input: [{ role: "user", content }],
      max_output_tokens: maxOutputTokens,
    });

    return response.output_text ?? "";
  },
};
