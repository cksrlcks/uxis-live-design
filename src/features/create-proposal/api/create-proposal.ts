"use client";

import { http } from "@/shared/api/http";
import type { CreateProposalInput } from "@/entities/proposal/model/create-schema";

// 시안 생성은 이름만 받는다 — 이미지는 생성 후 페이지 추가/새 버전에서 올린다.
// 생성 시 안(A)과 빈 버전(v1)이 자동으로 만들어진다.
export async function createProposalByName(
  title: string,
  workYear?: number,
): Promise<{ proposalId: string }> {
  const created = await http<{ proposalId: string }>("/api/proposals", {
    method: "POST",
    body: JSON.stringify({
      title,
      files: [],
      ...(workYear !== undefined && { workYear }),
    } satisfies CreateProposalInput),
  });
  return { proposalId: created.proposalId };
}
