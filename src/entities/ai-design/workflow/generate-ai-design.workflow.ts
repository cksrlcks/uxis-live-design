import {
  resolveAiDesignReferences,
  generateAiDesignHtml,
  markAiDesignDone,
  markAiDesignFailed,
} from "./steps";

// durable 워크플로우: 참고 이미지 추출 → Claude 생성 → 행 갱신. 실패 시 failed 표기.
export async function generateAiDesignWorkflow(id: string) {
  "use workflow";

  try {
    const { input, imageUrls } = await resolveAiDesignReferences(id);
    const html = await generateAiDesignHtml(input, imageUrls);
    await markAiDesignDone(id, html);
  } catch (err) {
    await markAiDesignFailed(id, err instanceof Error ? err.message : "생성 실패");
  }
}
