import { NextRequest } from "next/server";
import { getAiDesignHtml } from "@/entities/ai-design/api/get-ai-design-html.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const html = await getAiDesignHtml(id);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // 생성 HTML에 스크립트가 끼어도 외부 호출/탈취를 제한(인라인 스타일은 허용).
        "content-security-policy":
          "default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
