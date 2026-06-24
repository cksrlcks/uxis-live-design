import type { PublicTag } from "@/entities/tag/model/public-types";

// 공개 이미지 한 장: 영구 public URL + 원본 픽셀 크기. 배열 순서 = 표시 순서.
export type PublicPage = { url: string; width: number; height: number };

// 목록 요약 행: 커버 1장 + 태그 + 작성일(ISO).
export type PublicProposalSummary = {
  publicId: string;
  domain: string | null;
  title: string;
  createdAt: string; // ISO
  cover: PublicPage | null;
  tags: PublicTag[];
};

// 상세의 안 한 개: 최종버전 메타 + 그 버전의 페이지들.
export type PublicVariant = {
  slug: string;
  label: string;
  version: { versionNo: number; note: string | null } | null;
  pages: PublicPage[];
};

// 상세 전체.
export type PublicProposalDetail = {
  publicId: string;
  domain: string | null;
  title: string;
  createdAt: string; // ISO
  tags: PublicTag[];
  variants: PublicVariant[];
};
