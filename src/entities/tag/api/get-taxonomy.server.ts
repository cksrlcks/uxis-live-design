import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/shared/db";
import { tagGroups, tagOptions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import type { Taxonomy, TagOption } from "../model/types";

export async function getTaxonomy(): Promise<Taxonomy> {
  await requireEditor();

  const groups = await db
    .select()
    .from(tagGroups)
    .orderBy(asc(tagGroups.sortOrder), asc(tagGroups.createdAt));
  const options = await db
    .select()
    .from(tagOptions)
    .orderBy(asc(tagOptions.sortOrder), asc(tagOptions.createdAt));

  const byGroup = new Map<string, TagOption[]>();
  for (const o of options) {
    const list = byGroup.get(o.groupId) ?? [];
    list.push({
      id: o.id,
      groupId: o.groupId,
      code: o.code,
      label: o.label,
      description: o.description,
      sortOrder: o.sortOrder,
    });
    byGroup.set(o.groupId, list);
  }

  return groups.map((g) => ({
    id: g.id,
    code: g.code,
    label: g.label,
    description: g.description,
    sortOrder: g.sortOrder,
    options: byGroup.get(g.id) ?? [],
  }));
}
