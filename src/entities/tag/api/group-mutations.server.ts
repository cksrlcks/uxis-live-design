import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { tagGroups } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { groupCreateSchema, groupUpdateSchema } from "../model/schemas";
import type { TagGroup } from "../model/types";

export async function createGroup(input: unknown): Promise<TagGroup> {
  await requireAdmin();
  const data = groupCreateSchema.parse(input);
  const [row] = await db
    .insert(tagGroups)
    .values({
      code: data.code,
      label: data.label,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}

export async function updateGroup(id: string, input: unknown): Promise<void> {
  await requireAdmin();
  const data = groupUpdateSchema.parse(input);
  await db.update(tagGroups).set(data).where(eq(tagGroups.id, id));
}

export async function deleteGroup(id: string): Promise<void> {
  await requireAdmin();
  // tag_options + proposal_tags 는 ON DELETE CASCADE 로 함께 삭제된다.
  await db.delete(tagGroups).where(eq(tagGroups.id, id));
}
