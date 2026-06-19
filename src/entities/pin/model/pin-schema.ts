import { z } from "zod";

export const MAX_PIN_BODY = 2000;
export const pinBodySchema = z.string().trim().min(1).max(MAX_PIN_BODY);

export const createPinInputSchema = z.object({
  variantId: z.string().min(1),
  versionId: z.string().min(1),
  pageOrder: z.number().int().min(0),
  xNorm: z.number(),
  yNorm: z.number(),
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
