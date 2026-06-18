import { z } from "zod";

export const updateRoleSchema = z.object({
  role: z.enum(["pending", "editor", "admin"]),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
