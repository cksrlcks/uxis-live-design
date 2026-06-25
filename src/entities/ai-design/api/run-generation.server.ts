import "server-only";
import { resolveReferences, markDone, markFailed } from "./generation-mutations.server";
import { generateHtml } from "./generate-html.server";

// after() 인라인 생성 실행 (Vercel Workflows dispatch 대체).
// 워크플로우 오케스트레이터와 동일한 3스텝: 참고 이미지 해석 → Claude 생성 → 행 갱신.
// 실패 시 행을 failed로 표기. after()는 호출 함수의 maxDuration(현재 300s) 안에서 완료돼야 한다.
// durable(자동 재시도)은 없으므로 타임아웃/크래시 시 working에 남고 "재시도" 버튼으로 복구한다.
export async function runGeneration(id: string): Promise<void> {
  try {
    const { input, imageUrls } = await resolveReferences(id);
    const html = await generateHtml(input, imageUrls);
    await markDone(id, html);
  } catch (err) {
    await markFailed(id, err instanceof Error ? err.message : "생성 실패");
  }
}
