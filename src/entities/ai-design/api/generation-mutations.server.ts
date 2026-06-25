import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns, aiDesignTags, tagOptions } from "@drizzle/schema";
import { getTagMatchedImages } from "./get-tag-matched-images.server";
import type { GenerationInput } from "../model/types";
import type { PageType } from "../model/constants";
import { AI_DESIGN_MODEL } from "../model/constants";

export async function resolveReferences(
  id: string,
): Promise<{ input: GenerationInput; imageUrls: string[] }> {
  const [row] = await db.select().from(aiDesigns).where(eq(aiDesigns.id, id)).limit(1);
  if (!row) throw new Error("NOT_FOUND");

  const tagRows = await db
    .select({ optionId: aiDesignTags.optionId, label: tagOptions.label })
    .from(aiDesignTags)
    .innerJoin(tagOptions, eq(tagOptions.id, aiDesignTags.optionId))
    .where(eq(aiDesignTags.aiDesignId, id));

  const images = await getTagMatchedImages(tagRows.map((t) => t.optionId));

  return {
    input: {
      title: row.title,
      company: row.company,
      pageType: row.pageType as PageType,
      tagLabels: tagRows.map((t) => t.label),
      extraNotes: row.extraNotes,
    },
    imageUrls: images.map((i) => i.url),
  };
}

export async function markDone(id: string, html: string): Promise<void> {
  await db
    .update(aiDesigns)
    .set({ html, status: "done", model: AI_DESIGN_MODEL, errorMessage: null, updatedAt: new Date() })
    .where(eq(aiDesigns.id, id));
}

export async function markFailed(id: string, message: string): Promise<void> {
  await db
    .update(aiDesigns)
    .set({ status: "failed", errorMessage: message.slice(0, 500), updatedAt: new Date() })
    .where(eq(aiDesigns.id, id));
}
