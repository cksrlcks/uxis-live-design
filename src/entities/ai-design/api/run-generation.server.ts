import "server-only";
import { resolveReferences, markDone, markFailed } from "./generation-mutations.server";
import { generateHtml } from "./generate-html.server";

// after() 인라인 생성 실행 (Vercel Workflows dispatch 대체).
// 워크플로우 오케스트레이터와 동일한 3스텝: 참고 이미지 해석 → Claude 생성 → 행 갱신.
// 실패 시 행을 failed로 표기. after()는 호출 함수의 maxDuration(현재 600s=10분, Pro) 안에서 완료돼야 한다.
// durable(자동 재시도)은 없으므로 타임아웃/크래시 시 working에 남고 "재시도" 버튼으로 복구한다.
//
// 관측: Vercel Logs에서 `[ai-design]`로 필터.
//   start 로그가 보이면 after()가 실행돼 생성이 시작된 것. start가 없으면 after() 자체가 안 돈 것.
export async function runGeneration(id: string): Promise<void> {
  const startedAt = Date.now();
  console.log(`[ai-design] generation start id=${id}`);
  try {
    const { input, imageUrls } = await resolveReferences(id);
    const html = await generateHtml(input, imageUrls);
    await markDone(id, html);
    console.log(
      `[ai-design] generation done id=${id} ms=${Date.now() - startedAt} htmlChars=${html.length} images=${imageUrls.length}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "생성 실패";
    await markFailed(id, message);
    console.error(`[ai-design] generation failed id=${id} ms=${Date.now() - startedAt} error=${message}`);
  }
}
