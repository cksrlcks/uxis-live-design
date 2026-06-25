import "server-only";
import { AI_PROVIDER, PROVIDER_BY_MODEL } from "../model/constants";
import type { GenerationInput, GeneratedDesign } from "../model/types";
import { stripCodeFence } from "../lib/strip-code-fence";
import type { AiHtmlProvider } from "./providers/types";
import { openaiProvider } from "./providers/openai.server";
import { anthropicProvider } from "./providers/anthropic.server";

const PAGE_TYPE_LABEL: Record<GenerationInput["pageType"], string> = {
  main: "메인/랜딩 페이지",
  dashboard: "대시보드(좌측 사이드바 + 상단 KPI 카드 + 차트/표)",
  subpage: "서브페이지(헤더 + 본문 + 사이드)",
};

const SYSTEM_PROMPT = [
  "당신은 시니어 웹 디자이너 겸 프론트엔드 개발자입니다.",
  "요구사항과 참고 이미지(기존 시안)를 분석해, 하나의 완결형 HTML 문서를 생성합니다.",
  "",
  "다음 순서로 정확히 출력하세요(이 외 설명/코드펜스 금지):",
  "1) <분석>...</분석> — 참고 시안과 요구사항을 어떻게 이해했는지 2~3문장(한국어).",
  "2) <도입>...</도입> — 참고 시안의 어떤 요소를 이번 시안에 어떻게 반영했는지 1~2문장(한국어).",
  "3) '<!DOCTYPE html>'로 시작하는 단일 HTML 문서. 앞의 두 태그 뒤에 이어서 출력.",
  "",
  "HTML 규칙:",
  "- CSS는 <style>에 인라인. 외부 스크립트/네트워크/폰트 CDN 의존을 최소화.",
  "- 참고 이미지의 레이아웃/톤/구성요소를 참고하되 그대로 베끼지 말고 요구사항에 맞게 재구성.",
  "- 색상은 절제하여 사용한다. primary·secondary를 정해 일관된 스타일 가이드를 따르고, 강조색은 1~2개로 제한한다. 과도하게 화려한 색이나 무분별한 그라데이션은 지양.",
  "- 모서리(border-radius)는 적당히 둥글게(약 6~10px). 버튼이 pill 형태이거나 과하게 둥근 모서리는 지양.",
  "- 한국어 콘텐츠. 실제같은 더미 텍스트 사용.",
].join("\n");

// 태그(<분석>/<도입>)에서 내용 추출. 없으면 null.
function extractTag(raw: string, tag: string): string | null {
  const m = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  const value = m?.[1]?.trim();
  return value ? value : null;
}

// 모델 출력(분석/도입 태그 + HTML)을 파싱. 태그가 없으면 분석/도입은 null로 두고 HTML만 사용(하위호환).
function parseGeneration(raw: string): GeneratedDesign {
  const analysis = extractTag(raw, "분석");
  const approach = extractTag(raw, "도입");

  // 태그 블록을 제거한 나머지를 HTML로 본다.
  const rest = raw
    .replace(/<분석>[\s\S]*?<\/분석>/gi, "")
    .replace(/<도입>[\s\S]*?<\/도입>/gi, "")
    .trim();

  let html = stripCodeFence(rest);
  // 혹시 HTML 앞에 잡설명이 붙었으면 <!DOCTYPE html>부터 사용.
  const docIdx = html.search(/<!DOCTYPE html/i);
  if (docIdx > 0) html = html.slice(docIdx).trim();

  return { html, analysis, approach };
}

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

const MAX_OUTPUT_TOKENS = 32000;

// 제공사 레지스트리. AI_PROVIDER로 선택. 새 제공사는 여기에 등록한다.
const PROVIDERS: Record<string, AiHtmlProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

// 모델로 제공사를 골라 시안 생성. HTML + 분석/도입 설명을 함께 반환. 실패 시 throw(러너가 잡아 failed 처리).
export async function generateHtml(
  input: GenerationInput,
  imageUrls: string[],
  model: string,
): Promise<GeneratedDesign> {
  const providerKey = PROVIDER_BY_MODEL[model] ?? AI_PROVIDER;
  const provider = PROVIDERS[providerKey];
  if (!provider) throw new Error(`UNKNOWN_AI_PROVIDER:${providerKey}`);

  const raw = await provider.generate({
    model,
    system: SYSTEM_PROMPT,
    userText: buildUserText(input),
    imageUrls,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  const result = parseGeneration(raw);
  if (!result.html) throw new Error("EMPTY_GENERATION");
  return result;
}
