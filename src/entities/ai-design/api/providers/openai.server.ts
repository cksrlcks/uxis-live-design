import "server-only";
import OpenAI from "openai";
import type { AiHtmlProvider, GenerateHtmlRequest } from "./types";

// 클라이언트는 최초 사용 시점에 생성(다른 provider 사용 시 OPENAI_API_KEY를 요구하지 않도록 지연 초기화).
let client: OpenAI | null = null;
const getClient = () => (client ??= new OpenAI());

// === OpenAI 전용 성능 튜닝 노브(env) ===
// 추론 강도. gpt-5.5 같은 추론 모델에만 의미. 낮을수록 숨은 추론 토큰↓ → 가장 큰 속도 향상.
// "off"면 reasoning 파라미터 자체를 생략(비추론 모델에 안전). 기본 low.
const VALID_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;
const rawEffort = (process.env.AI_REASONING_EFFORT ?? "low").toLowerCase();
const REASONING_EFFORT: OpenAI.ReasoningEffort | null =
  rawEffort === "off"
    ? null
    : (VALID_EFFORTS as readonly string[]).includes(rawEffort)
      ? (rawEffort as OpenAI.ReasoningEffort)
      : "low";

// 이미지 인식 해상도. "low"면 장당 고정 소량 토큰으로 처리 → 비전 prefill↓ → 첫 토큰까지 빨라짐.
// 레이아웃/여백/리듬 같은 전반적 분위기 파악엔 low로 충분. 기본 low.
const VALID_DETAILS = ["low", "high", "auto"] as const;
const rawDetail = (process.env.AI_IMAGE_DETAIL ?? "low").toLowerCase();
const IMAGE_DETAIL: "low" | "high" | "auto" = (VALID_DETAILS as readonly string[]).includes(rawDetail)
  ? (rawDetail as "low" | "high" | "auto")
  : "low";

// OpenAI Responses API(vision)로 HTML 시안 생성.
export const openaiProvider: AiHtmlProvider = {
  async generate({ model, system, userText, imageUrls, maxOutputTokens }: GenerateHtmlRequest): Promise<string> {
    const content: OpenAI.Responses.ResponseInputMessageContentList = [
      ...imageUrls.map(
        (url): OpenAI.Responses.ResponseInputImage => ({
          type: "input_image",
          image_url: url,
          detail: IMAGE_DETAIL,
        }),
      ),
      { type: "input_text", text: userText },
    ];

    const response = await getClient().responses.create({
      model,
      instructions: system,
      input: [{ role: "user", content }],
      max_output_tokens: maxOutputTokens,
      ...(REASONING_EFFORT ? { reasoning: { effort: REASONING_EFFORT } } : {}),
    });

    return response.output_text ?? "";
  },
};
