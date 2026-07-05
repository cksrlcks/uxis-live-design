// 생성된 HTML 시안을 ai_designs(status=done) + ai_design_tags 스냅샷으로 저장.
// 공개 저장 라우트(app/api/public/design-patterns/designs)와 repo 스크립트(scripts/save-ai-design.mts) 양쪽에서 쓴다.
// "server-only"는 tsx에서 throw하므로 넣지 않는다.
import { inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns, aiDesignTags, tagOptions, tagGroups } from "@drizzle/schema";

export type SaveDesignInput = {
  title: string;
  company?: string | null;
  pageType: "main" | "dashboard" | "subpage" | "product";
  extraNotes?: string | null;
  optionIds?: string[];
  html: string;
  analysis?: string | null;
  approach?: string | null;
  model?: string;
  createdBy?: string | null; // 토큰 소유자(profiles.id). 라우트에서 주입.
};

const PAGE_TYPES = ["main", "dashboard", "subpage", "product"];
const MAX_HTML_CHARS = 10 * 1024 * 1024; // 단일 HTML 시안 상한 10MB(방어). 정상 시안은 보통 수십~수백 KB.

export async function saveGeneratedDesign(input: SaveDesignInput): Promise<{ id: string }> {
  // 에러 코드는 toErrorResponse의 STATUS_BY_CODE와 맞춘다(OBJECT_MISSING/BAD_QUERY → 400).
  if (!input?.title || !input?.pageType || !input?.html) throw new Error("OBJECT_MISSING");
  if (!PAGE_TYPES.includes(input.pageType)) throw new Error("BAD_QUERY");
  if (input.html.length > MAX_HTML_CHARS) throw new Error("BAD_QUERY");

  const [row] = await db
    .insert(aiDesigns)
    .values({
      title: input.title,
      company: input.company ?? null,
      pageType: input.pageType,
      extraNotes: input.extraNotes ?? null,
      status: "done",
      html: input.html,
      analysis: input.analysis ?? null,
      approach: input.approach ?? null,
      model: input.model ?? "claude-code",
      createdBy: input.createdBy ?? null,
    })
    .returning({ id: aiDesigns.id });
  const aiDesignId = row.id;

  const optionIds = input.optionIds ?? [];
  if (optionIds.length > 0) {
    const opts = await db
      .select({ id: tagOptions.id, label: tagOptions.label, sort: tagOptions.sortOrder, groupId: tagOptions.groupId })
      .from(tagOptions)
      .where(inArray(tagOptions.id, optionIds));
    const groupIds = [...new Set(opts.map((o) => o.groupId))];
    const groups = groupIds.length
      ? await db
          .select({ id: tagGroups.id, label: tagGroups.label, sort: tagGroups.sortOrder })
          .from(tagGroups)
          .where(inArray(tagGroups.id, groupIds))
      : [];
    const gmap = new Map(groups.map((g) => [g.id, g]));
    await db.insert(aiDesignTags).values(
      opts.map((o) => ({
        aiDesignId,
        optionId: o.id,
        groupLabel: gmap.get(o.groupId)?.label ?? "",
        optionLabel: o.label,
        groupSort: gmap.get(o.groupId)?.sort ?? 0,
        optionSort: o.sort,
      })),
    );
  }

  return { id: aiDesignId };
}
