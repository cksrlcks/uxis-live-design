import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/shared/db";
import { profiles } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import type { AdminUser } from "../model/types";
import type { Role } from "@/shared/auth/roles";

export async function getUsers(): Promise<AdminUser[]> {
  await requireAdmin();
  const rows = await db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role })
    .from(profiles)
    .orderBy(desc(profiles.createdAt));
  return rows.map((r) => ({ id: r.id, email: r.email, role: r.role as Role }));
}
