// NOTE: 이 모듈은 백필 스크립트(scripts/analyze-designs.mts, tsx)에서도 import한다.
// "server-only"는 tsx(순수 Node) 환경에서 import되면 throw하므로 의도적으로 넣지 않는다.
// 클라이언트 번들에서 쓰이지 않는 서버 전용 로직임은 `.server.ts` 네이밍으로 표시한다.
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiSettings } from "@drizzle/schema";
import {
  ANALYSIS_SYSTEM_PROMPT_KEY,
  ANALYSIS_MAX_OUTPUT_TOKENS,
  analysisProviderFor,
  SECTION_TYPES,
  COMPONENT_TYPES,
} from "../model/constants";
import { parsePageAnalysis, type PageAnalysisResult } from "../model/schemas";

// 지연 초기화 — 실제로 쓰는 provider의 API 키만 요구한다.
let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;
const getAnthropic = () => (anthropic ??= new Anthropic());
const getOpenAI = () => (openai ??= new OpenAI());

// DB에 analysis_system_prompt가 없을 때의 안전장치. 스키마·고정 enum을 프롬프트에 박아 넣는다.
const FALLBACK_SYSTEM_PROMPT = `당신은 시니어 웹 디자이너입니다. 첨부된 웹 시안(전체 페이지 스크린샷)을 분석해
재사용 가능한 디자인 패턴 데이터로 구조화하세요. 이미지의 텍스트를 그대로 옮기지 말고, 레이아웃·구성·톤 같은
패턴을 요약합니다.

반드시 아래 JSON 스키마만 출력하세요. 코드펜스나 설명 없이 JSON 객체 하나만 출력합니다.

{
  "overall": {
    "industry": "업종(한글, 추론)",
    "tone": "톤앤매너 한 줄",
    "styleKeywords": ["스타일 키워드"],
    "summary": "페이지 전체 요약 1~2문장",
    "promptSnippet": "HTML 생성 시 참고할 요약 문장"
  },
  "sections": [
    {
      "sectionType": "아래 섹션 목록 중 하나",
      "layoutType": "레이아웃 패턴(예: left-text-right-image, centered-visual)",
      "tone": "섹션 톤",
      "backgroundType": "solid | image | gradient 등",
      "colorPalette": ["#hex 또는 색 이름"],
      "components": [{ "type": "아래 컴포넌트 목록 중 하나", "styleKeywords": ["..."], "usage": "용도" }],
      "summary": "섹션 요약",
      "promptSnippet": "이 섹션을 재현할 때 참고할 한 줄"
    }
  ]
}

sectionType은 반드시 다음 중 하나: ${SECTION_TYPES.join(", ")}.
component의 type은 반드시 다음 중 하나: ${COMPONENT_TYPES.join(", ")}.
확실하지 않은 섹션/컴포넌트는 넣지 마세요. 위 목록에 없는 값은 절대 쓰지 마세요.`;

export async function getAnalysisSystemPrompt(): Promise<string> {
  const rows = await db
    .select({ value: aiSettings.value })
    .from(aiSettings)
    .where(eq(aiSettings.key, ANALYSIS_SYSTEM_PROMPT_KEY))
    .limit(1);
  return rows[0]?.value ?? FALLBACK_SYSTEM_PROMPT;
}

const USER_TEXT = "첨부된 시안 이미지를 분석해 위 스키마의 JSON만 출력하세요.";

async function callAnthropic(model: string, system: string, imageUrl: string): Promise<string> {
  const res = await getAnthropic().messages.create({
    model,
    max_tokens: ANALYSIS_MAX_OUTPUT_TOKENS,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: USER_TEXT },
        ],
      },
    ],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function callOpenAI(model: string, system: string, imageUrl: string): Promise<string> {
  const res = await getOpenAI().responses.create({
    model,
    instructions: system,
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: imageUrl, detail: "high" },
          { type: "input_text", text: USER_TEXT },
        ],
      },
    ],
    max_output_tokens: ANALYSIS_MAX_OUTPUT_TOKENS,
  });
  return res.output_text ?? "";
}

// 코드펜스 제거 후 첫 '{'부터 마지막 '}'까지 슬라이스해 JSON 파싱.
function extractJson(raw: string): unknown {
  const s = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("NO_JSON_IN_OUTPUT");
  return JSON.parse(s.slice(start, end + 1));
}

// 이미지 URL 1장을 vision 분석해 검증된 페이지 분석 결과를 반환. 실패 시 throw(스크립트가 failed 처리).
export async function analyzePage(imageUrl: string, model: string): Promise<PageAnalysisResult> {
  const system = await getAnalysisSystemPrompt();
  const provider = analysisProviderFor(model);
  const raw =
    provider === "anthropic"
      ? await callAnthropic(model, system, imageUrl)
      : await callOpenAI(model, system, imageUrl);
  if (!raw.trim()) throw new Error("EMPTY_ANALYSIS");
  return parsePageAnalysis(extractJson(raw));
}
