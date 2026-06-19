import { z } from "zod";

export const MAX_CHAT_BODY = 2000;

export const chatBodySchema = z.string().trim().min(1).max(MAX_CHAT_BODY);

export const createChatInputSchema = z.object({
  body: chatBodySchema,
  authorName: z.string().trim().min(1).max(80),
  authorColor: z.string().trim().min(1).max(32),
});
export type CreateChatInput = z.infer<typeof createChatInputSchema>;
