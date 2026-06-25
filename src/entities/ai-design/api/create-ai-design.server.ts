import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { db } from "@/shared/db";
import { aiDesigns, aiDesignTags } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { createAiDesignSchema } from "../model/schemas";
import { runGeneration } from "./run-generation.server";

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
    model: data.model,
    createdBy: admin.id,
  });

  if (data.optionIds.length > 0) {
    await db.insert(aiDesignTags).values(data.optionIds.map((optionId) => ({ aiDesignId: id, optionId })));
  }

  // 응답 후 백그라운드로 생성 실행(after). 함수 maxDuration(600s=10분) 안에서 완료. 행이 진실원천.
  after(() => runGeneration(id));

  return { id };
}
