import { z } from "zod";

// 페이지 박스 기준 정규화 좌표. 시안 밖도 허용하므로 핀과 동일하게 ±10으로만 제한.
const pointSchema = z.object({
  x: z.number().finite().min(-10).max(10),
  y: z.number().finite().min(-10).max(10),
});

export const MAX_STROKE_POINTS = 2000;
// 레이어(한 사용자×페이지)에 쌓일 수 있는 획 수 상한 — jsonb 폭주 방지.
export const MAX_LAYER_STROKES = 500;

// 레이어에 저장/전송되는 한 획. drawId는 클라가 만든 안정 식별자(렌더 key·dedupe·실시간).
export const strokeInputSchema = z.object({
  drawId: z.string().trim().min(1).max(64),
  // 2점 미만은 선이 아니다. 폭주 방지를 위해 점 수 상한(긴 선은 클라에서 단순화).
  points: z.array(pointSchema).min(2).max(MAX_STROKE_POINTS),
  color: z.string().trim().min(1).max(32),
  width: z.number().finite().min(0).max(1),
});
export type StrokeInput = z.infer<typeof strokeInputSchema>;

// 클라 → 서버 PUT 본문: 한 사용자의 그 페이지 레이어 전체(idempotent 교체).
export const layerUpsertInputSchema = z.object({
  variantId: z.string().min(1),
  versionId: z.string().min(1),
  pageOrder: z.number().int().min(0),
  strokes: z.array(strokeInputSchema).max(MAX_LAYER_STROKES),
  authorColor: z.string().trim().min(1).max(32),
});
export type LayerUpsertInput = z.infer<typeof layerUpsertInputSchema>;
