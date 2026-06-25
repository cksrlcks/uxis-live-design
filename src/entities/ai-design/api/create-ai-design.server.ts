import "server-only";
import { randomUUID } from "node:crypto";
import { start } from "workflow/api";
import { db } from "@/shared/db";
import { aiDesigns, aiDesignTags } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { createAiDesignSchema } from "../model/schemas";
import { AI_DESIGN_MODEL } from "../model/constants";
import { generateAiDesignWorkflow } from "../workflow/generate-ai-design.workflow";

export async function createAiDesign(input: unknown): Promise<{ id: string }> {
  const admin = await requireAdmin();
  const data = createAiDesignSchema.parse(input);

  const id = randomUUID();
  await db.insert(aiDesigns).values({
    id,
    title: data.title,
    company: data.company ?? null,
    pageType: data.pageType,
    extraNotes: data.extraNotes ?? null,
    status: "working",
    model: AI_DESIGN_MODEL,
    createdBy: admin.id,
  });

  if (data.optionIds.length > 0) {
    await db.insert(aiDesignTags).values(data.optionIds.map((optionId) => ({ aiDesignId: id, optionId })));
  }

  // durable 워크플로우 트리거(fire-and-forget; run id 미반환). 행이 진실원천.
  await start(generateAiDesignWorkflow, [id]);

  return { id };
}
