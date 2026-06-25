import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns, aiDesignReferenceProposals, aiDesignTags } from "@drizzle/schema";
import { getTagMatchedImages } from "./get-tag-matched-images.server";
import type { TagMatchedImage } from "./get-tag-matched-images.server";
import type { GenerationInput, GeneratedDesign } from "../model/types";
import type { PageType } from "../model/constants";
import { AI_DESIGN_MODEL } from "../model/constants";

export async function resolveReferences(
  id: string,
): Promise<{ input: GenerationInput; imageUrls: string[]; model: string }> {
  const [row] = await db.select().from(aiDesigns).where(eq(aiDesigns.id, id)).limit(1);
  if (!row) throw new Error("NOT_FOUND");

  // 스냅샷 라벨을 그대로 쓴다(조인 불필요). optionId는 참고 이미지 매칭에만 쓰며, 항목이
  // 삭제됐으면 null이라 매칭에서 제외한다.
  const tagRows = await db
    .select({ optionId: aiDesignTags.optionId, label: aiDesignTags.optionLabel })
    .from(aiDesignTags)
    .where(eq(aiDesignTags.aiDesignId, id));

  const optionIds = tagRows.map((t) => t.optionId).filter((x): x is string => !!x);
  const images = await getTagMatchedImages(optionIds);

  if (images.length > 0) {
    await saveReferences(id, images);
  }

  return {
    input: {
      title: row.title,
      company: row.company,
      pageType: row.pageType as PageType,
      tagLabels: tagRows.map((t) => t.label),
      extraNotes: row.extraNotes,
    },
    imageUrls: images.map((i) => i.url),
    // 생성 시 선택된 모델. 과거 행(null)은 환경 기본 모델로 폴백.
    model: row.model ?? AI_DESIGN_MODEL,
  };
}

// 재시도 시 이전 레코드를 교체하도록 delete + insert.
async function saveReferences(aiDesignId: string, refs: TagMatchedImage[]): Promise<void> {
  await db.delete(aiDesignReferenceProposals).where(eq(aiDesignReferenceProposals.aiDesignId, aiDesignId));
  await db.insert(aiDesignReferenceProposals).values(
    refs.map((ref, idx) => ({
      aiDesignId,
      proposalId: ref.proposalId,
      proposalTitle: ref.proposalTitle,
      imageUrl: ref.url,
      sortOrder: idx,
    })),
  );
}

export async function markDone(id: string, result: GeneratedDesign): Promise<void> {
  // model은 생성 시점에 저장됨 — 여기서 덮어쓰지 않는다.
  await db
    .update(aiDesigns)
    .set({
      html: result.html,
      analysis: result.analysis,
      approach: result.approach,
      status: "done",
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(aiDesigns.id, id));
}

export async function markFailed(id: string, message: string): Promise<void> {
  await db
    .update(aiDesigns)
    .set({ status: "failed", errorMessage: message.slice(0, 500), updatedAt: new Date() })
    .where(eq(aiDesigns.id, id));
}
