import { useMutation } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { type LayerUpsertInput } from "@/entities/whiteboard";

// 내 레이어(한 페이지의 내 획 전체)를 idempotent PUT으로 영속화.
// keepalive: 탭 종료(pagehide) 직전 호출도 전송이 보장되도록(소량 페이로드).
export function useLayerFlush(publicId: string) {
  return useMutation({
    mutationFn: (input: LayerUpsertInput) =>
      http<{ ok: true }>(`/api/p/${publicId}/strokes`, {
        method: "PUT",
        body: JSON.stringify(input),
        keepalive: true,
      }),
  });
}
