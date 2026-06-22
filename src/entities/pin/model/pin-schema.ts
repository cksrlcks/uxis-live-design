import { z } from "zod";

export const MAX_PIN_BODY = 2000;
export const pinBodySchema = z.string().trim().min(1).max(MAX_PIN_BODY);

export const createPinInputSchema = z.object({
  variantId: z.string().min(1),
  versionId: z.string().min(1),
  pageOrder: z.number().int().min(0),
  // 시안(페이지 박스) 밖에도 핀을 찍을 수 있어 0..1 범위를 벗어날 수 있다.
  // 저장 폭주 방지를 위해 페이지 기준 ±10배(=±1000%)로만 제한한다.
  xNorm: z.number().finite().min(-10).max(10),
  yNorm: z.number().finite().min(-10).max(10),
  authorColor: z.string().trim().min(1).max(32),
  body: pinBodySchema,
});
export type CreatePinInput = z.infer<typeof createPinInputSchema>;

// PATCH = exactly one of { body } | { resolved } (the legacy ONE_FIELD XOR).
export const patchPinInputSchema = z.union([
  z.object({ body: pinBodySchema }).strict(),
  z.object({ resolved: z.boolean() }).strict(),
]);
export type PatchPinInput = z.infer<typeof patchPinInputSchema>;
