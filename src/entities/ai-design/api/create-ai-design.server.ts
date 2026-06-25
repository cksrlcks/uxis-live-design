import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns, aiDesignTags, tagGroups, tagOptions } from "@drizzle/schema";
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
    // 생성 시점 라벨/정렬을 스냅샷으로 박는다 — 이후 태그가 삭제/변경돼도 상세 기록이 보존된다.
    const opts = await db
      .select({
        optionId: tagOptions.id,
        optionLabel: tagOptions.label,
        optionSort: tagOptions.sortOrder,
        groupLabel: tagGroups.label,
        groupSort: tagGroups.sortOrder,
      })
      .from(tagOptions)
      .innerJoin(tagGroups, eq(tagGroups.id, tagOptions.groupId))
      .where(inArray(tagOptions.id, data.optionIds));

    if (opts.length > 0) {
      await db.insert(aiDesignTags).values(
        opts.map((o) => ({
          aiDesignId: id,
          optionId: o.optionId,
          optionLabel: o.optionLabel,
          optionSort: o.optionSort,
          groupLabel: o.groupLabel,
          groupSort: o.groupSort,
        })),
      );
    }
  }

  // 응답 후 백그라운드로 생성 실행(after). 함수 maxDuration(600s=10분) 안에서 완료. 행이 진실원천.
  after(() => runGeneration(id));

  return { id };
}
