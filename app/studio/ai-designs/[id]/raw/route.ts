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
        // 외부 폰트(CDN)·CSS·이미지는 https로 허용하되 스크립트/네트워크 요청(connect/fetch)은
        // default-src 'none'으로 계속 차단 → 생성 HTML이 스크립트를 끼워도 실행·탈취 불가.
        "content-security-policy":
          "default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline' https:; font-src data: https:; base-uri 'none'",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
