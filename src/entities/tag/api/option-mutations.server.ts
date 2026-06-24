import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { tagOptions } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { optionCreateSchema, optionUpdateSchema } from "../model/schemas";
import type { TagOption } from "../model/types";

export async function createOption(input: unknown): Promise<TagOption> {
  await requireAdmin();
  const data = optionCreateSchema.parse(input);
  const [row] = await db
    .insert(tagOptions)
    .values({
      groupId: data.groupId,
      code: data.code,
      label: data.label,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return {
    id: row.id,
    groupId: row.groupId,
    code: row.code,
    label: row.label,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}

export async function updateOption(id: string, input: unknown): Promise<void> {
  await requireAdmin();
  const data = optionUpdateSchema.parse(input);
  await db.update(tagOptions).set(data).where(eq(tagOptions.id, id));
}

export async function deleteOption(id: string): Promise<void> {
  await requireAdmin();
  // proposal_tags 는 ON DELETE CASCADE 로 함께 삭제된다.
  await db.delete(tagOptions).where(eq(tagOptions.id, id));
}
