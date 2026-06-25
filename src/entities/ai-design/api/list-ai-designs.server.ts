import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import type { AiDesignListItem } from "../model/types";
import type { PageType, AiDesignStatus } from "../model/constants";

export async function listAiDesigns(): Promise<AiDesignListItem[]> {
  await requireAdmin();
  const rows = await db.select().from(aiDesigns).orderBy(desc(aiDesigns.createdAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    pageType: r.pageType as PageType,
    status: r.status as AiDesignStatus,
    hasHtml: !!r.html,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
