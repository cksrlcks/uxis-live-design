import "server-only";
import OpenAI from "openai";
import { AI_DESIGN_MODEL } from "../model/constants";
import type { GenerationInput } from "../model/types";
import { stripCodeFence } from "../lib/strip-code-fence";

const PAGE_TYPE_LABEL: Record<GenerationInput["pageType"], string> = {
  main: "메인/랜딩 페이지",
  dashboard: "대시보드(좌측 사이드바 + 상단 KPI 카드 + 차트/표)",
  subpage: "서브페이지(헤더 + 본문 + 사이드)",
};

const SYSTEM_PROMPT = [
  "당신은 시니어 웹 디자이너 겸 프론트엔드 개발자입니다.",
  "요구사항과 참고 이미지(기존 시안)를 분석해, 하나의 완결형 HTML 문서를 생성합니다.",
  "규칙:",
  "- 출력은 '<!DOCTYPE html>'로 시작하는 단일 HTML 문서 문자열만. 설명/마크다운/코드펜스 금지.",
  "- CSS는 <style>에 인라인. 외부 스크립트/네트워크/폰트 CDN 의존을 최소화.",
  "- 참고 이미지의 레이아웃/톤/구성요소를 참고하되 그대로 베끼지 말고 요구사항에 맞게 재구성.",
  "- 한국어 콘텐츠. 실제같은 더미 텍스트 사용.",
].join("\n");

function buildUserText(input: GenerationInput): string {
  const lines = [
    `회사/제목: ${input.title}${input.company ? ` (${input.company})` : ""}`,
    `페이지 유형: ${PAGE_TYPE_LABEL[input.pageType]}`,
  ];
  if (input.tagLabels.length) lines.push(`태그/방향성: ${input.tagLabels.join(", ")}`);
  if (input.extraNotes) lines.push(`추가 요청사항: ${input.extraNotes}`);
  lines.push("", "위 요구사항과 첨부된 참고 시안 이미지를 바탕으로 HTML 시안을 생성하세요.");
  return lines.join("\n");
}

const client = new OpenAI();

// OpenAI(gpt-5.5, vision, Responses API)로 HTML 시안 생성. 실패 시 throw(러너가 잡아 failed 처리).
export async function generateHtml(input: GenerationInput, imageUrls: string[]): Promise<string> {
  const content: OpenAI.Responses.ResponseInputMessageContentList = [
    ...imageUrls.map(
      (url): OpenAI.Responses.ResponseInputImage => ({
        type: "input_image",
        image_url: url,
        detail: "auto",
      }),
    ),
    { type: "input_text", text: buildUserText(input) },
  ];

  const response = await client.responses.create({
    model: AI_DESIGN_MODEL,
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content }],
    max_output_tokens: 32000,
  });

  const html = stripCodeFence(response.output_text ?? "");
  if (!html) throw new Error("EMPTY_GENERATION");
  return html;
}
