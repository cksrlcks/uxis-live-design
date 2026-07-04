import { getTagTaxonomy } from "@/entities/design-analysis/api/query-patterns.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 공개(무인증) — 시안 태그 택소노미(구분/항목 코드·라벨). 스킬이 태그 선택지를 보기 위해 호출.
export async function GET() {
  try {
    return Response.json(await getTagTaxonomy());
  } catch (error) {
    return toErrorResponse(error);
  }
}
