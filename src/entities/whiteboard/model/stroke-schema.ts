import { z } from "zod";

// 페이지 박스 기준 정규화 좌표. 시안 밖도 허용하므로 핀과 동일하게 ±10으로만 제한.
const pointSchema = z.object({
  x: z.number().finite().min(-10).max(10),
  y: z.number().finite().min(-10).max(10),
});

export const MAX_STROKE_POINTS = 2000;

export const createStrokeInputSchema = z.object({
  variantId: z.string().min(1),
  versionId: z.string().min(1),
  pageOrder: z.number().int().min(0),
  // 2점 미만은 선이 아니다. 폭주 방지를 위해 점 수 상한을 둔다(긴 선은 클라이언트에서 단순화).
  points: z.array(pointSchema).min(2).max(MAX_STROKE_POINTS),
  color: z.string().trim().min(1).max(32),
  width: z.number().finite().min(0).max(1),
  authorName: z.string().trim().min(1).max(64),
  authorColor: z.string().trim().min(1).max(32),
});
export type CreateStrokeInput = z.infer<typeof createStrokeInputSchema>;
