import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { profiles } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { ROLES } from "@/shared/auth/roles";
import { updateRoleSchema } from "../model/role-schema";

export async function updateUserRole(id: string, input: unknown): Promise<void> {
  const admin = await requireAdmin();
  if (id === admin.id) throw new Error("CANNOT_MODIFY_SELF");
  const { role } = updateRoleSchema.parse(input);

  await db
    .update(profiles)
    .set({
      role,
      approvedAt: role === ROLES.PENDING ? null : new Date(),
      approvedBy: role === ROLES.PENDING ? null : admin.id,
    })
    .where(eq(profiles.id, id));
}
