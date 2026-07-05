import { z } from "zod";

export const updateAnalyzeSchema = z.object({ allowAnalyze: z.boolean() });
export type UpdateAnalyzeInput = z.infer<typeof updateAnalyzeSchema>;
