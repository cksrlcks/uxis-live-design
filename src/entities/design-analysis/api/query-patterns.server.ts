// 태그 택소노미 조회 + 태그(라벨/코드)로 분석 패턴 검색.
// 공개 API 라우트(app/api/public/design-patterns/*)와 repo 스크립트(scripts/query-patterns.mts) 양쪽에서 쓴다.
// "server-only"는 tsx에서 throw하므로 넣지 않는다(서버 전용은 `.server.ts`로 표시).
import { asc } from "drizzle-orm";
import { db } from "@/shared/db";
import { tagGroups, tagOptions } from "@drizzle/schema";
import { getAnalyzedPatterns } from "./get-analyzed-patterns.server";
import type { AnalyzedPatterns } from "../model/types";

export type TagTaxonomy = {
  groups: { code: string; label: string; options: { code: string; label: string }[] }[];
};

export async function getTagTaxonomy(): Promise<TagTaxonomy> {
  const [groups, opts] = await Promise.all([
    db.select().from(tagGroups).orderBy(asc(tagGroups.sortOrder)),
    db.select().from(tagOptions).orderBy(asc(tagOptions.sortOrder)),
  ]);
  return {
    groups: groups.map((g) => ({
      code: g.code,
      label: g.label,
      options: opts
        .filter((o) => o.groupId === g.id)
        .map((o) => ({ code: o.code, label: o.label })),
    })),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export type ResolvedPatterns = {
  matchedTags: { code: string; label: string }[];
  unmatchedTokens: string[];
  optionIds: string[];
  patterns: AnalyzedPatterns;
};

// 라벨 또는 코드(공백/대소문자 무시)로 tag_options를 매칭 → optionIds → getAnalyzedPatterns.
export async function resolvePatternsByTags(
  tokens: string[],
  opts: { proposalLimit?: number; maxSections?: number; perProposal?: number } = {},
): Promise<ResolvedPatterns> {
  const clean = tokens.map((t) => t.trim()).filter(Boolean);
  const allOpts = await db.select().from(tagOptions);
  const hit = (t: string) =>
    allOpts.some((o) => norm(o.code) === norm(t) || norm(o.label) === norm(t));
  const matched = allOpts.filter((o) =>
    clean.some((t) => norm(o.code) === norm(t) || norm(o.label) === norm(t)),
  );
  const optionIds = matched.map((o) => o.id);
  const patterns: AnalyzedPatterns = optionIds.length
    ? await getAnalyzedPatterns(optionIds, opts)
    : { patternSnippets: [], sections: [] };
  return {
    matchedTags: matched.map((o) => ({ code: o.code, label: o.label })),
    unmatchedTokens: clean.filter((t) => !hit(t)),
    optionIds,
    patterns,
  };
}
