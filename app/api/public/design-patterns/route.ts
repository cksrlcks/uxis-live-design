import { NextRequest } from "next/server";
import { resolvePatternsByTags } from "@/entities/design-analysis/api/query-patterns.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 공개(무인증) — 선택 태그(라벨/코드, 콤마구분)로 사전 분석된 섹션 패턴을 반환.
// 예: /api/public/design-patterns?tags=제안,관광/레저&maxSections=24
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokens = (searchParams.get("tags") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const maxRaw = Number(searchParams.get("maxSections") ?? "24");
    const maxSections = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(Math.floor(maxRaw), 60) : 24;
    return Response.json(await resolvePatternsByTags(tokens, { maxSections }));
  } catch (error) {
    return toErrorResponse(error);
  }
}
