import { http } from "@/shared/api/http";
import { PROPOSALS_PAGE_SIZE, type Paginated, type Proposal } from "../model/types";

export function getProposals(
  page = 1,
  pageSize = PROPOSALS_PAGE_SIZE,
): Promise<Paginated<Proposal>> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return http<Paginated<Proposal>>(`/api/proposals?${qs}`);
}
